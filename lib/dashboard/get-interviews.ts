import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listLatestDraftsForCandidates } from "@/lib/db/drafts";
import type { Band, Role } from "@/lib/processing/types";

export interface InterviewCandidate {
  candidateId: string;
  name: string;
  email: string;
  role: Role;
  total: number | null;
  band: Band | null;
  keyInsight: string;
  probes: string[];
  risks: string[];
  hiddenValue: { item: string; quote: string }[];
  resumeSummary: string | null;
  briefMd: string | null;
  invitedAt: string;
}

/**
 * Candidates who have actually been invited to interview -- i.e. the
 * invite email genuinely sent, not merely marked "advance". A failed send
 * means they were never really contacted, so they stay off this list
 * (they remain visible, and actionable, on their role tab).
 */
export async function getInterviewCandidates(): Promise<InterviewCandidate[]> {
  const supabase = getSupabaseAdmin();

  const { data: emails, error: emailsError } = await supabase
    .from("emails")
    .select("candidate_id, sent_at")
    .eq("type", "invite")
    .eq("status", "sent")
    .order("sent_at", { ascending: false });
  if (emailsError) throw emailsError;

  const candidateIds = (emails ?? []).map((e) => e.candidate_id);
  if (candidateIds.length === 0) return [];

  const [candidatesRes, scoresRes] = await Promise.all([
    supabase
      .from("candidates")
      .select("id, name, email, role_applied, resume_summary")
      .in("id", candidateIds),
    supabase.from("scores").select("*").in("candidate_id", candidateIds),
  ]);
  if (candidatesRes.error) throw candidatesRes.error;
  if (scoresRes.error) throw scoresRes.error;

  const drafts = await listLatestDraftsForCandidates(candidateIds);

  const candidateById = new Map((candidatesRes.data ?? []).map((c) => [c.id, c]));
  const invitedAtById = new Map((emails ?? []).map((e) => [e.candidate_id, e.sent_at]));

  return candidateIds
    .map((id) => {
      const candidate = candidateById.get(id);
      if (!candidate) return null;

      // Prefer the score for the role they applied for; fall back to any
      // variant they were cross-scored on.
      const scores = (scoresRes.data ?? []).filter((s) => s.candidate_id === id);
      const score =
        scores.find((s) => s.rubric_variant === candidate.role_applied) ?? scores[0] ?? null;

      const brief = drafts.find((d) => d.candidate_id === id && d.type === "invite");

      return {
        candidateId: id,
        name: candidate.name ?? "(name not found on CV)",
        email: candidate.email,
        role: candidate.role_applied as Role,
        total: score ? Number(score.total) : null,
        band: (score?.band ?? null) as Band | null,
        keyInsight: score?.key_insight ?? "",
        probes: (score?.probes as string[] | null) ?? [],
        risks: ((score?.risks as { overall?: string[] } | null)?.overall as string[]) ?? [],
        hiddenValue: (score?.hidden_value as { item: string; quote: string }[] | null) ?? [],
        resumeSummary: candidate.resume_summary ?? null,
        briefMd: brief?.brief_md ?? null,
        invitedAt: invitedAtById.get(id) ?? "",
      } satisfies InterviewCandidate;
    })
    .filter((c): c is InterviewCandidate => c !== null);
}
