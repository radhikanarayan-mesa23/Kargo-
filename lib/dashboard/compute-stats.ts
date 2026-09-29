import type { RoleViewCandidate } from "@/lib/dashboard/build-role-view";

export interface RoleStats {
  totalResumes: number;
  priorityShortlist: number;
  shortlist: number;
  onHold: number;
  declineQueue: number;
  sentToInterview: number;
  rejected: number;
  pendingReview: number;
  /** DECLINE_QUEUE candidates nobody has decided on yet -- what "Send all
   * queued declines" would actually act on. */
  queuedDeclines: number;
}

/** Pure so it's unit-testable without hitting Supabase -- takes the already
 * -fetched, already-filtered candidate list plus the count of HOLD
 * candidates buildRoleView hid (still "resumes on file", just not shown). */
export function computeStats(
  candidates: RoleViewCandidate[],
  hiddenHoldCount: number,
): RoleStats {
  let priorityShortlist = 0;
  let shortlist = 0;
  let onHold = 0;
  let declineQueue = 0;
  let sentToInterview = 0;
  let rejected = 0;
  let queuedDeclines = 0;

  for (const c of candidates) {
    switch (c.band) {
      case "PRIORITY_SHORTLIST":
        priorityShortlist++;
        break;
      case "SHORTLIST":
        shortlist++;
        break;
      case "HOLD":
        onHold++;
        break;
      case "DECLINE_QUEUE":
        declineQueue++;
        if (!c.decision) queuedDeclines++;
        break;
    }
    if (c.emails.invite?.status === "sent") sentToInterview++;
    if (c.emails.decline?.status === "sent") rejected++;
  }

  const totalResumes = candidates.length + hiddenHoldCount;
  const pendingReview = totalResumes - sentToInterview - rejected;

  return {
    totalResumes,
    priorityShortlist,
    shortlist,
    onHold: onHold + hiddenHoldCount,
    declineQueue,
    sentToInterview,
    rejected,
    pendingReview,
    queuedDeclines,
  };
}
