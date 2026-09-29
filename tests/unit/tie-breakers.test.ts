import { describe, expect, it } from "vitest";
import { compareCandidatesForRanking } from "@/lib/processing/tie-breakers";
import type { RankInput } from "@/lib/processing/types";

function rank(overrides: Partial<RankInput>): RankInput {
  return {
    candidateId: "x",
    band: "SHORTLIST",
    total: 70,
    c1: 2,
    c2: 2,
    hiddenValueCount: 0,
    recentHandsOnOpsMonths: 0,
    ...overrides,
  };
}

describe("compareCandidatesForRanking", () => {
  it("ranks a higher band ahead of a lower one regardless of total", () => {
    const priority = rank({ candidateId: "a", band: "PRIORITY_SHORTLIST", total: 81 });
    const shortlist = rank({ candidateId: "b", band: "SHORTLIST", total: 79 });
    const sorted = [shortlist, priority].sort(compareCandidatesForRanking);
    expect(sorted[0].candidateId).toBe("a");
  });

  it("within the same band, ranks higher total first", () => {
    const higher = rank({ candidateId: "a", total: 90 });
    const lower = rank({ candidateId: "b", total: 85 });
    const sorted = [lower, higher].sort(compareCandidatesForRanking);
    expect(sorted[0].candidateId).toBe("a");
  });

  it("tie-break 1: same band+total, higher C1 wins", () => {
    const higherC1 = rank({ candidateId: "a", c1: 4 });
    const lowerC1 = rank({ candidateId: "b", c1: 2 });
    const sorted = [lowerC1, higherC1].sort(compareCandidatesForRanking);
    expect(sorted[0].candidateId).toBe("a");
  });

  it("tie-break 2: same band+total+C1, higher C2 wins", () => {
    const higherC2 = rank({ candidateId: "a", c2: 4 });
    const lowerC2 = rank({ candidateId: "b", c2: 1 });
    const sorted = [lowerC2, higherC2].sort(compareCandidatesForRanking);
    expect(sorted[0].candidateId).toBe("a");
  });

  it("tie-break 3: same through C2, more Hidden Value items wins", () => {
    const moreHiddenValue = rank({ candidateId: "a", hiddenValueCount: 3 });
    const fewerHiddenValue = rank({ candidateId: "b", hiddenValueCount: 0 });
    const sorted = [fewerHiddenValue, moreHiddenValue].sort(compareCandidatesForRanking);
    expect(sorted[0].candidateId).toBe("a");
  });

  it("tie-break 4: same through hidden value, more recent hands-on ops exposure wins", () => {
    const moreRecent = rank({ candidateId: "a", recentHandsOnOpsMonths: 12 });
    const lessRecent = rank({ candidateId: "b", recentHandsOnOpsMonths: 1 });
    const sorted = [lessRecent, moreRecent].sort(compareCandidatesForRanking);
    expect(sorted[0].candidateId).toBe("a");
  });
});
