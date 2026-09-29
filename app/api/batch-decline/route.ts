import { NextRequest, NextResponse } from "next/server";
import { listScoresWithCandidatesByVariant } from "@/lib/db/scores";
import { listDecisionsForCandidates } from "@/lib/db/decisions";
import { decideAndSend } from "@/lib/actions/decide-and-send";
import type { RawScoreRow } from "@/lib/dashboard/build-role-view";
import type { Role } from "@/lib/processing/types";

export const maxDuration = 300;

/**
 * Declines every DECLINE_QUEUE candidate for a role that has no decision
 * recorded yet, in one batch -- so Arjun approves the whole queue at once
 * rather than one card at a time. Reuses decideAndSend's guard logic, not a
 * separate copy of it.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const role = ((body?.role as Role | undefined) ?? "pm") as Role;

  const rows = (await listScoresWithCandidatesByVariant(role)) as unknown as RawScoreRow[];
  const declineQueueRows = rows.filter((r) => r.band === "DECLINE_QUEUE" && r.candidates);

  const candidateIds = declineQueueRows.map((r) => r.candidate_id);
  const decisions = await listDecisionsForCandidates(candidateIds);
  const alreadyDecided = new Set(decisions.map((d) => d.candidate_id));

  const targets = declineQueueRows.filter((r) => !alreadyDecided.has(r.candidate_id));

  const results: Array<{ candidateId: string } & Awaited<ReturnType<typeof decideAndSend>>> = [];
  for (const row of targets) {
    const result = await decideAndSend({
      candidateId: row.candidate_id,
      rubricVariant: role,
      decision: "decline",
    });
    results.push({ candidateId: row.candidate_id, ...result });
  }

  return NextResponse.json({
    total: targets.length,
    sent: results.filter((r) => r.ok && r.emailed && r.emailStatus === "sent").length,
    failed: results.filter((r) => !r.ok || (r.ok && r.emailStatus === "failed")).length,
    results,
  });
}
