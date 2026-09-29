import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type EmailType = "invite" | "decline";
export type EmailMode = "dry" | "live";

export interface EmailRow {
  id: string;
  candidate_id: string;
  type: EmailType;
  mode: EmailMode;
  resend_id: string | null;
  status: string;
  error: string | null;
  sent_at: string;
}

export async function findEmail(
  candidateId: string,
  type: EmailType,
): Promise<EmailRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("type", type)
    .maybeSingle();
  if (error) throw error;
  return data as EmailRow | null;
}

export async function recordEmail(input: {
  candidateId: string;
  type: EmailType;
  mode: EmailMode;
  resendId?: string | null;
  status: string;
  error?: string | null;
}): Promise<EmailRow> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("emails")
    .insert({
      candidate_id: input.candidateId,
      type: input.type,
      mode: input.mode,
      resend_id: input.resendId ?? null,
      status: input.status,
      error: input.error ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmailRow;
}

export async function listEmailsForCandidates(candidateIds: string[]): Promise<EmailRow[]> {
  if (candidateIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("emails")
    .select("*")
    .in("candidate_id", candidateIds);
  if (error) throw error;
  return data as EmailRow[];
}
