import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type DraftType = "invite" | "decline";

export interface DraftRow {
  id: string;
  candidate_id: string;
  type: DraftType;
  subject: string;
  body_template: string;
  brief_md: string;
  created_at: string;
}

export async function saveDraft(input: {
  candidateId: string;
  type: DraftType;
  subject: string;
  bodyTemplate: string;
  briefMd: string;
}): Promise<DraftRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("drafts")
    .insert({
      candidate_id: input.candidateId,
      type: input.type,
      subject: input.subject,
      body_template: input.bodyTemplate,
      brief_md: input.briefMd,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DraftRow;
}

export async function getLatestDraft(
  candidateId: string,
  type: DraftType,
): Promise<DraftRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DraftRow | null;
}

export async function listLatestDraftsForCandidates(
  candidateIds: string[],
): Promise<DraftRow[]> {
  if (candidateIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .in("candidate_id", candidateIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // One row per (candidate, type): keep only the most recent of each since
  // the query above is already ordered newest-first.
  const seen = new Set<string>();
  const latest: DraftRow[] = [];
  for (const row of data as DraftRow[]) {
    const key = `${row.candidate_id}:${row.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    latest.push(row);
  }
  return latest;
}
