import { describe, expect, it } from "vitest";
import { computeOutcomes, rate, type OutcomeInput } from "@/lib/dashboard/compute-outcomes";

function input(overrides: Partial<OutcomeInput> = {}): OutcomeInput {
  return {
    invited: [],
    outcomeByCandidate: new Map(),
    decisionsByCandidate: new Map(),
    ...overrides,
  };
}

const outcome = (o: Partial<{
  interviewResult: "strong" | "mixed" | "weak" | "no_show" | null;
  offer: "none" | "made" | "accepted" | "turned_down";
  startedOn: string | null;
  check90d: "exceeding" | "meeting" | "struggling" | "left" | null;
}> = {}) => ({
  interviewResult: null,
  offer: "none" as const,
  startedOn: null,
  check90d: null,
  ...o,
});

describe("computeOutcomes", () => {
  it("reports no bands when nobody has been invited", () => {
    const stats = computeOutcomes(input());
    expect(stats.byBand).toEqual([]);
    expect(stats.totalInvited).toBe(0);
  });

  it("counts an invited candidate with nothing recorded as awaiting an outcome", () => {
    const stats = computeOutcomes(
      input({ invited: [{ candidateId: "a", band: "SHORTLIST" }] }),
    );
    expect(stats.awaitingOutcome).toBe(1);
    expect(stats.byBand[0].invited).toBe(1);
    expect(stats.byBand[0].interviewed).toBe(0);
  });

  it("does not count a no-show as an interview", () => {
    const stats = computeOutcomes(
      input({
        invited: [{ candidateId: "a", band: "SHORTLIST" }],
        outcomeByCandidate: new Map([["a", outcome({ interviewResult: "no_show" })]]),
      }),
    );
    expect(stats.byBand[0].interviewed).toBe(0);
    expect(stats.awaitingOutcome).toBe(0);
  });

  it("counts a turned-down offer as an offer that was made", () => {
    const stats = computeOutcomes(
      input({
        invited: [{ candidateId: "a", band: "PRIORITY_SHORTLIST" }],
        outcomeByCandidate: new Map([["a", outcome({ offer: "turned_down" })]]),
      }),
    );
    expect(stats.byBand[0].offersMade).toBe(1);
    expect(stats.byBand[0].accepted).toBe(0);
  });

  it("separates the 90-day denominator from those still unchecked", () => {
    const stats = computeOutcomes(
      input({
        invited: [
          { candidateId: "a", band: "SHORTLIST" },
          { candidateId: "b", band: "SHORTLIST" },
        ],
        outcomeByCandidate: new Map([
          ["a", outcome({ startedOn: "2026-01-05", check90d: "exceeding" })],
          ["b", outcome({ startedOn: "2026-02-05" })],
        ]),
      }),
    );
    expect(stats.byBand[0].started).toBe(2);
    expect(stats.byBand[0].checked90d).toBe(1);
    expect(stats.byBand[0].workingOut).toBe(1);
  });

  it("counts someone struggling at 90 days as not working out", () => {
    const stats = computeOutcomes(
      input({
        invited: [{ candidateId: "a", band: "SHORTLIST" }],
        outcomeByCandidate: new Map([["a", outcome({ check90d: "struggling" })]]),
      }),
    );
    expect(stats.byBand[0].checked90d).toBe(1);
    expect(stats.byBand[0].workingOut).toBe(0);
  });

  it("keeps bands separate so their conversion can be compared", () => {
    const stats = computeOutcomes(
      input({
        invited: [
          { candidateId: "a", band: "PRIORITY_SHORTLIST" },
          { candidateId: "b", band: "SHORTLIST" },
        ],
        outcomeByCandidate: new Map([
          ["a", outcome({ interviewResult: "strong" })],
          ["b", outcome({ interviewResult: "weak" })],
        ]),
      }),
    );
    const priority = stats.byBand.find((b) => b.band === "PRIORITY_SHORTLIST")!;
    const shortlist = stats.byBand.find((b) => b.band === "SHORTLIST")!;
    expect(priority.strong).toBe(1);
    expect(shortlist.strong).toBe(0);
    expect(shortlist.interviewed).toBe(1);
  });

  it("leaves an unscored invitee out of the bands but inside the total", () => {
    const stats = computeOutcomes(
      input({ invited: [{ candidateId: "a", band: null }] }),
    );
    expect(stats.byBand).toEqual([]);
    expect(stats.totalInvited).toBe(1);
  });

  it("counts a decline that was later overturned as a reversed decline", () => {
    const stats = computeOutcomes(
      input({
        decisionsByCandidate: new Map([
          ["a", [{ decision: "advance" }, { decision: "decline" }]],
        ]),
      }),
    );
    expect(stats.reversedDeclines).toBe(1);
  });

  it("does not count a decline that still stands", () => {
    const stats = computeOutcomes(
      input({
        decisionsByCandidate: new Map([
          ["a", [{ decision: "decline" }, { decision: "hold" }]],
          ["b", [{ decision: "decline" }]],
        ]),
      }),
    );
    expect(stats.reversedDeclines).toBe(0);
  });
});

describe("rate", () => {
  it("returns null rather than inventing a rate from nothing", () => {
    expect(rate(0, 0)).toBeNull();
  });

  it("rounds to a whole percent", () => {
    expect(rate(1, 3)).toBe(33);
    expect(rate(2, 3)).toBe(67);
  });
});
