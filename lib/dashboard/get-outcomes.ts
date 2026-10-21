import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listOutcomes, type OutcomeRow } from "@/lib/db/outcomes";
import { computeOutcomes, type OutcomeStats } from "@/lib/dashboard/compute-outcomes";
import type { Band } from "@/lib/processing/types";

/**
 * Outcome stats across everyone who was genuinely invited (invite email
 * actually sent), plus the raw rows so a card can show what's recorded.
 */
export async function getOutcomeStats(): Promise<{
  stats: OutcomeStats;
  byCandidate: Map<string, OutcomeRow>;
}> {
  const supabase = getSupabaseAdmin();

  const { data: emails, error: emailsError } = await supabase
    .from("emails")
    .select("candidate_id")
    .eq("type", "invite")
    .eq("status", "sent");
  if (emailsError) throw emailsError;

  const invitedIds = [...new Set((emails ?? []).map((e) => e.candidate_id))];

  // Decisions are fetched for *every* candidate, not just the invited
  // ones: a reversed decline is by definition someone who was never
  // invited at the time, and that's the signal worth counting.
  const [candidatesRes, scoresRes, decisionsRes, outcomes] = await Promise.all([
    supabase.from("candidates").select("id, role_applied").in("id", invitedIds.length ? invitedIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("scores").select("candidate_id, rubric_variant, band").in("candidate_id", invitedIds.length ? invitedIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("decisions").select("candidate_id, decision, decided_at").order("decided_at", { ascending: false }),
    listOutcomes(invitedIds.length ? invitedIds : []),
  ]);
  if (candidatesRes.error) throw candidatesRes.error;
  if (scoresRes.error) throw scoresRes.error;
  if (decisionsRes.error) throw decisionsRes.error;

  const roleById = new Map((candidatesRes.data ?? []).map((c) => [c.id, c.role_applied]));

  const invited = invitedIds.map((id) => {
    const role = roleById.get(id);
    const scores = (scoresRes.data ?? []).filter((s) => s.candidate_id === id);
    // Prefer the band for the role they applied for, as the role tabs do.
    const score = scores.find((s) => s.rubric_variant === role) ?? scores[0];
    return { candidateId: id, band: (score?.band ?? null) as Band | null };
  });

  const decisionsByCandidate = new Map<string, { decision: "advance" | "hold" | "decline" }[]>();
  for (const d of decisionsRes.data ?? []) {
    const list = decisionsByCandidate.get(d.candidate_id) ?? [];
    list.push({ decision: d.decision });
    decisionsByCandidate.set(d.candidate_id, list);
  }

  const byCandidate = new Map(outcomes.map((o) => [o.candidate_id, o]));

  const outcomeByCandidate = new Map(
    outcomes.map((o) => [
      o.candidate_id,
      {
        interviewResult: o.interview_result,
        offer: o.offer,
        startedOn: o.started_on,
        check90d: o.check_90d,
      },
    ]),
  );

  return {
    stats: computeOutcomes({ invited, outcomeByCandidate, decisionsByCandidate }),
    byCandidate,
  };
}
