import { NextRequest, NextResponse } from "next/server";
import {
  upsertOutcome,
  type InterviewResult,
  type OfferState,
  type OutcomePatch,
  type TenureCheck,
} from "@/lib/db/outcomes";
import { findCandidateById } from "@/lib/db/candidates";

const RESULTS = new Set<InterviewResult>(["strong", "mixed", "weak", "no_show"]);
const OFFERS = new Set<OfferState>(["none", "made", "accepted", "turned_down"]);
const CHECKS = new Set<TenureCheck>(["exceeding", "meeting", "struggling", "left"]);

/** A date input the browser sends as "" when cleared, which must become
 * null rather than an invalid date. */
function dateOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  return v;
}

function enumOrNull<T>(v: unknown, allowed: Set<T>): T | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return allowed.has(v as T) ? (v as T) : undefined;
}

/**
 * Records what actually happened to a candidate after the invite. Every
 * field is optional and only the ones supplied are written, so filling in
 * the 90-day check months later never blanks the interview result.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const candidateId = body?.candidateId;

  if (typeof candidateId !== "string") {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  const candidate = await findCandidateById(candidateId);
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const patch: OutcomePatch = {};
  const interviewedOn = dateOrNull(body?.interviewedOn);
  if (interviewedOn !== undefined) patch.interviewedOn = interviewedOn;
  const startedOn = dateOrNull(body?.startedOn);
  if (startedOn !== undefined) patch.startedOn = startedOn;
  const interviewResult = enumOrNull(body?.interviewResult, RESULTS);
  if (interviewResult !== undefined) patch.interviewResult = interviewResult;
  const check90d = enumOrNull(body?.check90d, CHECKS);
  if (check90d !== undefined) patch.check90d = check90d;
  if (typeof body?.offer === "string" && OFFERS.has(body.offer as OfferState)) {
    patch.offer = body.offer as OfferState;
  }
  if (typeof body?.note === "string") patch.note = body.note.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No recognised outcome fields supplied" }, { status: 400 });
  }

  try {
    const row = await upsertOutcome(candidateId, patch);
    return NextResponse.json({ ok: true, outcome: row });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not save outcome: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
