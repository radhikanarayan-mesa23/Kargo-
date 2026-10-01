import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { computeOverview, type OverviewStats } from "@/lib/dashboard/compute-overview";
import type { Role } from "@/lib/processing/types";

export async function getOverview(): Promise<OverviewStats> {
  const supabase = getSupabaseAdmin();

  const [candidatesRes, scoresRes, decisionsRes, emailsRes] = await Promise.all([
    supabase.from("candidates").select("id, role_applied"),
    supabase.from("scores").select("candidate_id"),
    supabase.from("decisions").select("candidate_id, decision, decided_at").order("decided_at", { ascending: false }),
    supabase.from("emails").select("candidate_id, type, status"),
  ]);

  for (const res of [candidatesRes, scoresRes, decisionsRes, emailsRes]) {
    if (res.error) throw res.error;
  }

  const decisionByCandidate = new Map<string, "advance" | "hold" | "decline">();
  for (const d of decisionsRes.data ?? []) {
    // Ordered newest-first, so the first one seen per candidate is current.
    if (!decisionByCandidate.has(d.candidate_id)) {
      decisionByCandidate.set(d.candidate_id, d.decision);
    }
  }

  return computeOverview({
    candidates: (candidatesRes.data ?? []) as { id: string; role_applied: Role }[],
    scoredIds: new Set((scoresRes.data ?? []).map((s) => s.candidate_id)),
    decisionByCandidate,
    sentEmails: (emailsRes.data ?? [])
      .filter((e) => e.status === "sent")
      .map((e) => ({ candidate_id: e.candidate_id, type: e.type })),
  });
}
