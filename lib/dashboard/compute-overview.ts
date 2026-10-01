import type { Role } from "@/lib/processing/types";

export interface RoleBreakdown {
  uploaded: number;
  scored: number;
  awaitingDecision: number;
  sentToInterview: number;
  rejected: number;
  onHold: number;
}

export interface OverviewStats {
  totalUploaded: number;
  totalScored: number;
  totalEmailsSent: number;
  awaitingDecision: number;
  sentToInterview: number;
  rejected: number;
  onHold: number;
  byRole: Record<Role, RoleBreakdown>;
}

export interface OverviewInput {
  candidates: { id: string; role_applied: Role }[];
  /** Candidate ids that have at least one score row. */
  scoredIds: Set<string>;
  /** Latest decision per candidate, if any. */
  decisionByCandidate: Map<string, "advance" | "hold" | "decline">;
  /** Successfully-sent emails only, keyed by candidate id. */
  sentEmails: { candidate_id: string; type: "invite" | "decline" }[];
}

function emptyBreakdown(): RoleBreakdown {
  return {
    uploaded: 0,
    scored: 0,
    awaitingDecision: 0,
    sentToInterview: 0,
    rejected: 0,
    onHold: 0,
  };
}

/**
 * Whole-pipeline counts for the overview tab, split by role. Pure so it
 * can be unit-tested without Supabase -- the caller does the fetching.
 *
 * "Awaiting decision" is Arjun's actual to-do pile: scored, but he hasn't
 * clicked Advance/Hold/Decline yet. A candidate still mid-processing
 * (uploaded but not scored) deliberately doesn't count, since there's
 * nothing for him to act on yet.
 */
export function computeOverview(input: OverviewInput): OverviewStats {
  const byRole: Record<Role, RoleBreakdown> = {
    pm: emptyBreakdown(),
    spm: emptyBreakdown(),
  };

  const roleOf = new Map<string, Role>();
  for (const c of input.candidates) {
    roleOf.set(c.id, c.role_applied);
    byRole[c.role_applied].uploaded++;

    if (input.scoredIds.has(c.id)) {
      byRole[c.role_applied].scored++;
      const decision = input.decisionByCandidate.get(c.id);
      if (!decision) byRole[c.role_applied].awaitingDecision++;
      if (decision === "hold") byRole[c.role_applied].onHold++;
    }
  }

  for (const e of input.sentEmails) {
    const role = roleOf.get(e.candidate_id);
    if (!role) continue;
    if (e.type === "invite") byRole[role].sentToInterview++;
    else byRole[role].rejected++;
  }

  const sum = (pick: (b: RoleBreakdown) => number) => pick(byRole.pm) + pick(byRole.spm);

  return {
    totalUploaded: sum((b) => b.uploaded),
    totalScored: sum((b) => b.scored),
    totalEmailsSent: input.sentEmails.length,
    awaitingDecision: sum((b) => b.awaitingDecision),
    sentToInterview: sum((b) => b.sentToInterview),
    rejected: sum((b) => b.rejected),
    onHold: sum((b) => b.onHold),
    byRole,
  };
}
