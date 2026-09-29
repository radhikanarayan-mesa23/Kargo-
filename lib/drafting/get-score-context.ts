import "server-only";
import { findCandidateById } from "@/lib/db/candidates";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Role } from "@/lib/processing/types";

interface RawRisks {
  overall?: string[];
}

interface RawScoreForDrafting {
  probes: unknown;
  risks: unknown;
  hidden_value: unknown;
  key_insight: string | null;
}

/** Narrows the generic `Json` columns on a scores row into the shapes the
 * app actually writes to them (see lib/db/scores.ts's saveScore). */
export function readDraftingContext(score: RawScoreForDrafting) {
  return {
    probes: (score.probes as string[] | null) ?? [],
    risks: ((score.risks as RawRisks | null)?.overall as string[] | undefined) ?? [],
    hiddenValue: (score.hidden_value as { item: string; quote: string }[] | null) ?? [],
    keyInsight: score.key_insight ?? "",
  };
}

export async function getScoreContext(candidateId: string, rubricVariant?: Role) {
  const candidate = await findCandidateById(candidateId);
  if (!candidate) return null;

  const variant = rubricVariant ?? (candidate.role_applied as Role);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("rubric_variant", variant)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return { candidate, score: data, rubricVariant: variant };
}
