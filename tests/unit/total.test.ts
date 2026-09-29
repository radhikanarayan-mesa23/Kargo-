import { describe, expect, it } from "vitest";
import { computeRoleAgnosticTotal, computeWeightedTotal } from "@/lib/processing/total";
import type { Criteria } from "@/lib/processing/types";

function criterion(score: 0 | 1 | 2 | 3 | 4): Criteria["c1"] {
  return { score, quotes: [], confidence: "H", risks: [] };
}

describe("computeWeightedTotal", () => {
  it("matches the plan's hand-computed regression example: 3,4,2,3,4 -> 80.0", () => {
    const criteria: Criteria = {
      c1: criterion(3),
      c2: criterion(4),
      c3: criterion(2),
      c4: criterion(3),
      c5: criterion(4),
    };
    expect(computeWeightedTotal(criteria)).toBe(80.0);
  });

  it("is 100 when every criterion scores 4/4", () => {
    const criteria: Criteria = {
      c1: criterion(4),
      c2: criterion(4),
      c3: criterion(4),
      c4: criterion(4),
      c5: criterion(4),
    };
    expect(computeWeightedTotal(criteria)).toBe(100);
  });

  it("is 0 when every criterion scores 0/4", () => {
    const criteria: Criteria = {
      c1: criterion(0),
      c2: criterion(0),
      c3: criterion(0),
      c4: criterion(0),
      c5: criterion(0),
    };
    expect(computeWeightedTotal(criteria)).toBe(0);
  });

  it("matches the Section 10 calibration example: Lavanya (C1-5=4,3,4,4,4) -> 95", () => {
    const criteria: Criteria = {
      c1: criterion(4),
      c2: criterion(3),
      c3: criterion(4),
      c4: criterion(4),
      c5: criterion(4),
    };
    expect(computeWeightedTotal(criteria)).toBe(95);
  });
});

describe("computeRoleAgnosticTotal (Section 10 calibration, C1/C2/C3/C5 only, max 75)", () => {
  it("matches the Section 10 table row-for-row", () => {
    const rows: [string, [number, number, number, number], number][] = [
      ["Rohan", [4, 4, 4, 4], 75.0],
      ["Sunita", [4, 4, 4, 4], 75.0],
      ["Meghna", [4, 4, 4, 3], 71.3],
      ["Lavanya", [4, 3, 4, 4], 70.0],
      ["Aditya", [3, 3, 3, 4], 60.0],
      ["Preetham", [1, 3, 2, 1], 32.5],
      ["Rahul", [0, 0, 2, 3], 18.8],
      ["Vikram", [0, 0, 2, 1], 11.3],
    ];

    for (const [name, [c1, c2, c3, c5], expected] of rows) {
      const total = computeRoleAgnosticTotal({
        c1: criterion(c1 as 0 | 1 | 2 | 3 | 4),
        c2: criterion(c2 as 0 | 1 | 2 | 3 | 4),
        c3: criterion(c3 as 0 | 1 | 2 | 3 | 4),
        c5: criterion(c5 as 0 | 1 | 2 | 3 | 4),
      });
      expect(total, `${name}: expected ${expected}, got ${total}`).toBeCloseTo(expected, 1);
    }
  });
});
