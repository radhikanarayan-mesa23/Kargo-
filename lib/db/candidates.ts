import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export type RoleApplied = "pm" | "spm";

export interface Candidate {
  id: string;
  created_at: string;
  role_applied: RoleApplied;
  name: string | null;
  email: string;
  phone: string | null;
  cv_path: string | null;
  cv_text_redacted: string | null;
  status: string;
  resume_summary: string | null;
}

export type CandidateStatus =
  | "uploaded"
  | "scoring"
  | "scored"
  | "needs_review"
  | "advanced"
  | "held"
  | "declined";

export async function findCandidateById(id: string): Promise<Candidate | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Candidate | null;
}

export async function updateCandidateStatus(
  id: string,
  status: CandidateStatus,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("candidates").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function findCandidateByEmail(
  email: string,
): Promise<Candidate | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (error) throw error;
  return data as Candidate | null;
}

export interface UpsertCandidateInput {
  roleApplied: RoleApplied;
  name: string | null;
  email: string;
  phone: string | null;
  cvPath: string;
  cvTextRedacted: string;
}

/**
 * Dedupes on email: a re-upload updates the existing candidate row (new file,
 * new redacted text, status reset to "uploaded") instead of creating a
 * duplicate. Returns the resulting row plus whether it was a fresh insert.
 */
export async function upsertCandidate(
  input: UpsertCandidateInput,
): Promise<{ candidate: Candidate; wasExisting: boolean }> {
  const supabase = getSupabaseAdmin();
  const existing = await findCandidateByEmail(input.email);

  if (existing) {
    const { data, error } = await supabase
      .from("candidates")
      .update({
        role_applied: input.roleApplied,
        name: input.name,
        phone: input.phone,
        cv_path: input.cvPath,
        cv_text_redacted: input.cvTextRedacted,
        status: "uploaded",
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return { candidate: data as Candidate, wasExisting: true };
  }

  const { data, error } = await supabase
    .from("candidates")
    .insert({
      role_applied: input.roleApplied,
      name: input.name,
      email: input.email,
      phone: input.phone,
      cv_path: input.cvPath,
      cv_text_redacted: input.cvTextRedacted,
      status: "uploaded",
    })
    .select()
    .single();
  if (error) throw error;
  return { candidate: data as Candidate, wasExisting: false };
}

export async function setResumeSummary(id: string, summary: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("candidates")
    .update({ resume_summary: summary })
    .eq("id", id);
  if (error) throw error;
}
