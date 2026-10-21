import { NextRequest, NextResponse } from "next/server";
import { findCandidateById, updateCandidateStatus } from "@/lib/db/candidates";
import { getLatestDecision, recordDecision } from "@/lib/db/decisions";
import { findEmail } from "@/lib/db/emails";

/**
 * Puts a decided candidate back in play when Arjun changes his mind.
 *
 * `decisions` is append-only by design, so nothing is rewritten: this
 * appends a fresh row recording the reversal, and everything downstream
 * already reads the *latest* decision per candidate. The old decision
 * stays in the history, which is what makes a false negative countable
 * later (see computeOutcomes' reversedDeclines).
 *
 * This deliberately does not send anything. It returns the candidate to
 * the undecided pile so the normal Advance / Hold / Decline flow -- the
 * only path that can ever email -- applies again.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const candidateId = body?.candidateId;
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (typeof candidateId !== "string") {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  const candidate = await findCandidateById(candidateId);
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const latest = await getLatestDecision(candidateId);
  if (!latest) {
    return NextResponse.json(
      { error: "This candidate has no decision to reopen" },
      { status: 409 },
    );
  }

  // An email that already went out cannot be recalled. Reopening is still
  // allowed -- Arjun may well want to follow up by hand -- but the caller
  // is told, so the UI can say so plainly rather than implying an undo.
  const [sentInvite, sentDecline] = await Promise.all([
    findEmail(candidateId, "invite"),
    findEmail(candidateId, "decline"),
  ]);
  const alreadyEmailed = sentInvite ?? sentDecline;

  await recordDecision(
    candidateId,
    "hold",
    note
      ? `Reopened (was ${latest.decision}): ${note}`
      : `Reopened (was ${latest.decision})`,
  );
  await updateCandidateStatus(candidateId, "held");

  return NextResponse.json({
    ok: true,
    previousDecision: latest.decision,
    alreadyEmailed: alreadyEmailed
      ? { type: alreadyEmailed.type, sentAt: alreadyEmailed.sent_at }
      : null,
  });
}
