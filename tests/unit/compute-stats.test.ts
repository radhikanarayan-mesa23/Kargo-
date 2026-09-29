import { describe, expect, it } from "vitest";
import { computeStats } from "@/lib/dashboard/compute-stats";
import type { RoleViewCandidate } from "@/lib/dashboard/build-role-view";
import type { EmailRow } from "@/lib/db/emails";

function emailRow(status: string): EmailRow {
  return {
    id: "e1",
    candidate_id: "x",
    type: "invite",
    mode: "dry",
    resend_id: null,
    status,
    error: null,
    sent_at: new Date().toISOString(),
  };
}

function candidate(overrides: Partial<RoleViewCandidate> = {}): RoleViewCandidate {
  return {
    candidateId: "x",
    name: "Test",
    email: "x@example.com",
    status: "scored",
    band: "SHORTLIST",
    total: 65,
    keyInsight: "",
    criteria: [],
    hiddenValue: [],
    reason: "",
    decision: null,
    emails: {},
    recommendedDraftType: "invite",
    draft: null,
    ...overrides,
  };
}

describe("computeStats", () => {
  it("counts total resumes as visible candidates plus hidden HOLD ones", () => {
    const stats = computeStats([candidate(), candidate()], 3);
    expect(stats.totalResumes).toBe(5);
    expect(stats.onHold).toBe(3);
  });

  it("counts sent-to-interview and rejected from email status, not band", () => {
    const stats = computeStats(
      [
        candidate({ candidateId: "a", band: "PRIORITY_SHORTLIST", emails: { invite: emailRow("sent") } }),
        candidate({ candidateId: "b", band: "DECLINE_QUEUE", emails: { decline: emailRow("sent") } }),
        candidate({ candidateId: "c", band: "SHORTLIST" }),
      ],
      0,
    );
    expect(stats.sentToInterview).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.pendingReview).toBe(1);
  });

  it("counts queued declines as DECLINE_QUEUE candidates with no decision yet", () => {
    const stats = computeStats(
      [
        candidate({ candidateId: "a", band: "DECLINE_QUEUE", decision: null }),
        candidate({
          candidateId: "b",
          band: "DECLINE_QUEUE",
          decision: {
            id: "dec1",
            candidate_id: "b",
            decision: "decline",
            note: null,
            decided_at: "now",
          },
        }),
      ],
      0,
    );
    expect(stats.declineQueue).toBe(2);
    expect(stats.queuedDeclines).toBe(1);
  });

  it("does not double count a failed send as sent", () => {
    const stats = computeStats(
      [candidate({ emails: { invite: emailRow("failed") } })],
      0,
    );
    expect(stats.sentToInterview).toBe(0);
    expect(stats.pendingReview).toBe(1);
  });
});
