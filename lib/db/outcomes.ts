import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type InterviewResult = "strong" | "mixed" | "weak" | "no_show";
export type OfferState = "none" | "made" | "accepted" | "turned_down";
export type TenureCheck = "exceeding" | "meeting" | "struggling" | "left";

export interface OutcomeRow {
  candidate_id: string;
  interviewed_on: string | null;
  interview_result: InterviewResult | null;
  offer: OfferState;
  started_on: string | null;
  check_90d: TenureCheck | null;
  note: string | null;
  updated_at: string;
}

/** Every field is optional: Arjun fills these in over months, as reality
 * arrives, so a patch only touches what he actually supplied. */
export interface OutcomePatch {
  interviewedOn?: string | null;
  interviewResult?: InterviewResult | null;
  offer?: OfferState;
  startedOn?: string | null;
  check90d?: TenureCheck | null;
  note?: string | null;
}

export async function upsertOutcome(
  candidateId: string,
  patch: OutcomePatch,
): Promise<OutcomeRow> {
  const supabase = getSupabaseAdmin();

  // Only send keys the caller actually set, so a partial update never
  // blanks a field someone recorded earlier.
  const row: Database["public"]["Tables"]["outcomes"]["Insert"] = {
    candidate_id: candidateId,
    updated_at: new Date().toISOString(),
  };
  if ("interviewedOn" in patch) row.interviewed_on = patch.interviewedOn;
  if ("interviewResult" in patch) row.interview_result = patch.interviewResult;
  if ("offer" in patch) row.offer = patch.offer;
  if ("startedOn" in patch) row.started_on = patch.startedOn;
  if ("check90d" in patch) row.check_90d = patch.check90d;
  if ("note" in patch) row.note = patch.note;

  const { data, error } = await supabase
    .from("outcomes")
    .upsert(row, { onConflict: "candidate_id" })
    .select()
    .single();
  if (error) throw error;
  return data as OutcomeRow;
}

export async function listOutcomes(candidateIds?: string[]): Promise<OutcomeRow[]> {
  const supabase = getSupabaseAdmin();
  let q = supabase.from("outcomes").select("*");
  if (candidateIds) {
    if (candidateIds.length === 0) return [];
    q = q.in("candidate_id", candidateIds);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as OutcomeRow[];
}
