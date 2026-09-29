import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import type {
  Band,
  ExperienceFacts,
  GateResult,
  RoutingResult,
  Role,
} from "@/lib/processing/types";
import type { ScoredVariant } from "@/lib/scoring/score-candidate";

export interface SaveScoreInput {
  candidateId: string;
  rubricVariant: Role;
  variant: ScoredVariant;
  total: number;
  band: Band;
  gates: { g1: GateResult; g2: { flag: string }; g3: RoutingResult };
}

/** Shape of the `gates` jsonb column as actually persisted -- g1/g2/g3 plus
 * the raw experience facts, so the dashboard's tie-breaker (recency of
 * hands-on ops exposure) has real data without needing its own column. */
export interface PersistedGates {
  g1: GateResult;
  g2: { flag: string };
  g3: RoutingResult;
  experience: ExperienceFacts;
}

export async function saveScore(input: SaveScoreInput): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { criteria, hiddenValue, probes, risks, keyInsight, model } = input.variant;

  const { error } = await supabase.from("scores").upsert(
    {
      candidate_id: input.candidateId,
      rubric_variant: input.rubricVariant,
      c1: criteria.c1.score,
      c2: criteria.c2.score,
      c3: criteria.c3.score,
      c4: criteria.c4.score,
      c5: criteria.c5.score,
      confidence: {
        c1: criteria.c1.confidence,
        c2: criteria.c2.confidence,
        c3: criteria.c3.confidence,
        c4: criteria.c4.confidence,
        c5: criteria.c5.confidence,
      },
      quotes: {
        c1: criteria.c1.quotes,
        c2: criteria.c2.quotes,
        c3: criteria.c3.quotes,
        c4: criteria.c4.quotes,
        c5: criteria.c5.quotes,
      },
      gates: {
        ...input.gates,
        experience: input.variant.experience,
      } as unknown as Json,
      total: input.total,
      band: input.band,
      hidden_value: hiddenValue,
      probes,
      risks,
      key_insight: keyInsight,
      model,
    },
    { onConflict: "candidate_id,rubric_variant" },
  );

  if (error) throw error;
}

export async function listScoresForCandidate(candidateId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .eq("candidate_id", candidateId);
  if (error) throw error;
  return data;
}

export async function listScoresForCandidateIds(candidateIds: string[]) {
  if (candidateIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scores")
    .select("*")
    .in("candidate_id", candidateIds);
  if (error) throw error;
  return data;
}

/** Every scored candidate for one rubric variant (a dashboard tab), joined
 * with their candidate row. A candidate appears here either because they
 * applied for this role, or because G3 routing cross-scored them onto it. */
export async function listScoresWithCandidatesByVariant(rubricVariant: Role) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scores")
    .select("*, candidates(*)")
    .eq("rubric_variant", rubricVariant);
  if (error) throw error;
  return data;
}
