import { NextRequest, NextResponse } from "next/server";
import {
  findCandidateById,
  updateCandidateStatus,
  type RoleApplied,
} from "@/lib/db/candidates";
import { saveScore } from "@/lib/db/scores";
import { scoreCandidateWithAI, type ScoredVariant } from "@/lib/scoring/score-candidate";
import { processCandidateScore } from "@/lib/processing";
import type { Role } from "@/lib/processing/types";

export const maxDuration = 300;

async function scoreOneVariant(role: Role, cvTextRedacted: string) {
  const result = await scoreCandidateWithAI(role, cvTextRedacted);
  if (!result.ok) return result;

  const processed = processCandidateScore({
    role,
    criteria: result.variant.criteria,
    experience: result.variant.experience,
  });

  return { ok: true as const, variant: result.variant, processed };
}

function summarize(variant: ScoredVariant, processed: ReturnType<typeof processCandidateScore>) {
  return {
    total: processed.total,
    band: processed.band,
    gates: processed.gates,
    reason: processed.reason,
    keyInsight: variant.keyInsight,
    hiddenValue: variant.hiddenValue,
    probes: variant.probes,
  };
}

/**
 * Scores one candidate. Never sends an email -- that only ever happens from
 * /api/send after Arjun clicks. Makes one AI call for the candidate's
 * primary rubric variant, then (per G3 routing) a second call on the other
 * variant when warranted, persisting both as separate `scores` rows.
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
  if (!candidate.cv_text_redacted) {
    return NextResponse.json(
      { error: "Candidate has no extracted CV text" },
      { status: 422 },
    );
  }

  await updateCandidateStatus(candidateId, "scoring");

  const primaryRole = candidate.role_applied as RoleApplied;
  const primary = await scoreOneVariant(primaryRole, candidate.cv_text_redacted);

  if (!primary.ok) {
    await updateCandidateStatus(candidateId, "needs_review");
    return NextResponse.json({ error: primary.reason }, { status: 422 });
  }

  await saveScore({
    candidateId,
    rubricVariant: primaryRole,
    variant: primary.variant,
    total: primary.processed.total,
    band: primary.processed.band,
    gates: primary.processed.gates,
  });

  const results: Record<string, ReturnType<typeof summarize>> = {
    [primaryRole]: summarize(primary.variant, primary.processed),
  };

  const crossScoreRole = primary.processed.gates.g3.crossScoreRole;
  if (crossScoreRole) {
    const cross = await scoreOneVariant(crossScoreRole, candidate.cv_text_redacted);
    if (cross.ok) {
      await saveScore({
        candidateId,
        rubricVariant: crossScoreRole,
        variant: cross.variant,
        total: cross.processed.total,
        band: cross.processed.band,
        gates: cross.processed.gates,
      });
      results[crossScoreRole] = summarize(cross.variant, cross.processed);
    }
    // A cross-score failure doesn't block the primary result -- Arjun still
    // gets the primary variant; the cross variant is simply missing.
  }

  await updateCandidateStatus(candidateId, "scored");

  return NextResponse.json({ candidateId, scores: results });
}
