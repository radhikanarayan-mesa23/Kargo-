import "server-only";
import { listScoresForCandidateIds, listScoresWithCandidatesByVariant } from "@/lib/db/scores";
import { listDecisionsForCandidates, type DecisionRow } from "@/lib/db/decisions";
import { listEmailsForCandidates, type EmailRow, type EmailType } from "@/lib/db/emails";
import { listLatestDraftsForCandidates, type DraftRow } from "@/lib/db/drafts";
import { buildRoleView, type RawScoreRow } from "@/lib/dashboard/build-role-view";
import type { Role } from "@/lib/processing/types";

export async function getRoleView(role: Role) {
  const rows = (await listScoresWithCandidatesByVariant(role)) as unknown as RawScoreRow[];
  const candidateIds = rows.map((r) => r.candidate_id);

  const otherVariant: Role = role === "pm" ? "spm" : "pm";
  const allScores = (await listScoresForCandidateIds(candidateIds)) as unknown as RawScoreRow[];
  const otherVariantMap = new Map<string, RawScoreRow>(
    allScores
      .filter((r) => r.rubric_variant === otherVariant)
      .map((r) => [r.candidate_id, r]),
  );

  const decisions = await listDecisionsForCandidates(candidateIds);
  const decisionsMap = new Map<string, DecisionRow>();
  for (const d of decisions) {
    // decisions is ordered most-recent-first; keep only the first (latest)
    // occurrence per candidate.
    if (!decisionsMap.has(d.candidate_id)) decisionsMap.set(d.candidate_id, d);
  }

  const emailRows = await listEmailsForCandidates(candidateIds);
  const emailsMap = new Map<string, Partial<Record<EmailType, EmailRow>>>();
  for (const e of emailRows) {
    const existing = emailsMap.get(e.candidate_id) ?? {};
    existing[e.type] = e;
    emailsMap.set(e.candidate_id, existing);
  }

  const draftRows = await listLatestDraftsForCandidates(candidateIds);
  const draftsMap = new Map<string, Partial<Record<EmailType, DraftRow>>>();
  for (const d of draftRows) {
    const existing = draftsMap.get(d.candidate_id) ?? {};
    // listLatestDraftsForCandidates already keeps only the newest per
    // (candidate, type), so no ordering concern here.
    existing[d.type] = d;
    draftsMap.set(d.candidate_id, existing);
  }

  return buildRoleView(role, rows, otherVariantMap, decisionsMap, emailsMap, draftsMap);
}
