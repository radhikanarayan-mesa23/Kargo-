import { describe, expect, it } from "vitest";
import { computeOverview, type OverviewInput } from "@/lib/dashboard/compute-overview";

function input(overrides: Partial<OverviewInput> = {}): OverviewInput {
  return {
    candidates: [],
    scoredIds: new Set<string>(),
    decisionByCandidate: new Map(),
    sentEmails: [],
    ...overrides,
  };
}

describe("computeOverview", () => {
  it("splits uploaded counts by role", () => {
    const stats = computeOverview(
      input({
        candidates: [
          { id: "a", role_applied: "pm" },
          { id: "b", role_applied: "pm" },
          { id: "c", role_applied: "spm" },
        ],
      }),
    );
    expect(stats.totalUploaded).toBe(3);
    expect(stats.byRole.pm.uploaded).toBe(2);
    expect(stats.byRole.spm.uploaded).toBe(1);
  });

  it("counts only scored candidates with no decision as awaiting a decision", () => {
    const stats = computeOverview(
      input({
        candidates: [
          { id: "scored-undecided", role_applied: "pm" },
          { id: "scored-decided", role_applied: "pm" },
          { id: "not-scored-yet", role_applied: "pm" },
        ],
        scoredIds: new Set(["scored-undecided", "scored-decided"]),
        decisionByCandidate: new Map([["scored-decided", "advance"]]),
      }),
    );
    // Still-processing candidates aren't Arjun's to-do: nothing to act on.
    expect(stats.awaitingDecision).toBe(1);
    expect(stats.totalScored).toBe(2);
  });

  it("derives interview/rejection counts from sent emails, per role", () => {
    const stats = computeOverview(
      input({
        candidates: [
          { id: "a", role_applied: "pm" },
          { id: "b", role_applied: "spm" },
          { id: "c", role_applied: "spm" },
        ],
        scoredIds: new Set(["a", "b", "c"]),
        sentEmails: [
          { candidate_id: "a", type: "invite" },
          { candidate_id: "b", type: "invite" },
          { candidate_id: "c", type: "decline" },
        ],
      }),
    );
    expect(stats.sentToInterview).toBe(2);
    expect(stats.rejected).toBe(1);
    expect(stats.byRole.pm.sentToInterview).toBe(1);
    expect(stats.byRole.spm.sentToInterview).toBe(1);
    expect(stats.byRole.spm.rejected).toBe(1);
    expect(stats.totalEmailsSent).toBe(3);
  });

  it("counts candidates on hold separately", () => {
    const stats = computeOverview(
      input({
        candidates: [{ id: "a", role_applied: "pm" }],
        scoredIds: new Set(["a"]),
        decisionByCandidate: new Map([["a", "hold"]]),
      }),
    );
    expect(stats.onHold).toBe(1);
    expect(stats.awaitingDecision).toBe(0);
  });

  it("returns zeroed counts for an empty pipeline", () => {
    const stats = computeOverview(input());
    expect(stats.totalUploaded).toBe(0);
    expect(stats.byRole.pm.uploaded).toBe(0);
    expect(stats.byRole.spm.uploaded).toBe(0);
  });
});
