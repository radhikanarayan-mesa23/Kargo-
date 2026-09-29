import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type DecisionType = "advance" | "hold" | "decline";

export interface DecisionRow {
  id: string;
  candidate_id: string;
  decision: DecisionType;
  note: string | null;
  decided_at: string;
}

/** decisions is append-only in the DB (a trigger blocks update/delete) -- this
 * always inserts a new row, never updates one. */
export async function recordDecision(
  candidateId: string,
  decision: DecisionType,
  note?: string,
): Promise<DecisionRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decisions")
    .insert({ candidate_id: candidateId, decision, note })
    .select()
    .single();
  if (error) throw error;
  return data as DecisionRow;
}

export async function getLatestDecision(candidateId: string): Promise<DecisionRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DecisionRow | null;
}

export async function listDecisionsForCandidates(
  candidateIds: string[],
): Promise<DecisionRow[]> {
  if (candidateIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .in("candidate_id", candidateIds)
    .order("decided_at", { ascending: false });
  if (error) throw error;
  return data as DecisionRow[];
}
