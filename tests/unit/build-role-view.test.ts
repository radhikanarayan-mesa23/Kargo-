import { describe, expect, it } from "vitest";
import { buildRoleView, type RawScoreRow } from "@/lib/dashboard/build-role-view";

function row(overrides: Partial<RawScoreRow> & { candidate_id: string }): RawScoreRow {
  return {
    rubric_variant: "pm",
    c1: 2,
    c2: 2,
    c3: 2,
    c4: 2,
    c5: 2,
    confidence: { c1: "H", c2: "H", c3: "H", c4: "H", c5: "H" },
    quotes: { c1: [], c2: [], c3: [], c4: [], c5: [] },
    gates: {
      g1: { passed: true, flags: [] },
      g2: { flag: "CONFIRM IN FIRST REPLY" },
      g3: {},
      experience: {
        yearsProductOwnership: 0,
        yearsHandsOnOps: 0,
        foundingTeamProductWork: false,
        totalYearsPM: 0,
        ownedAreaWithoutSeniorPMAbove: false,
      },
    },
    total: 50,
    band: "HOLD",
    hidden_value: [],
    key_insight: "",
    candidates: {
      id: overrides.candidate_id,
      name: "Test Candidate",
      email: `${overrides.candidate_id}@example.com`,
      status: "scored",
      created_at: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("buildRoleView", () => {
  it("hides HOLD candidates once a role's shortlist reaches 5", () => {
    const rows: RawScoreRow[] = [
      ...Array.from({ length: 5 }, (_, i) =>
        row({ candidate_id: `shortlist-${i}`, band: "SHORTLIST", total: 65 }),
      ),
      row({ candidate_id: "hold-1", band: "HOLD", total: 50 }),
    ];
    const result = buildRoleView("pm", rows, new Map(), new Map(), new Map(), new Map());
    expect(result.candidates.some((c) => c.candidateId === "hold-1")).toBe(false);
    expect(result.hiddenHoldCount).toBe(1);
  });

  it("shows HOLD candidates when a role's shortlist has fewer than 5", () => {
    const rows: RawScoreRow[] = [
      row({ candidate_id: "shortlist-1", band: "SHORTLIST", total: 65 }),
      row({ candidate_id: "hold-1", band: "HOLD", total: 50 }),
    ];
    const result = buildRoleView("pm", rows, new Map(), new Map(), new Map(), new Map());
    expect(result.candidates.some((c) => c.candidateId === "hold-1")).toBe(true);
    expect(result.hiddenHoldCount).toBe(0);
  });

  it("sorts by band then total (Section 8 ordering)", () => {
    const rows: RawScoreRow[] = [
      row({ candidate_id: "a", band: "SHORTLIST", total: 65 }),
      row({ candidate_id: "b", band: "PRIORITY_SHORTLIST", total: 81 }),
      row({ candidate_id: "c", band: "DECLINE_QUEUE", total: 20 }),
    ];
    const result = buildRoleView("pm", rows, new Map(), new Map(), new Map(), new Map());
    expect(result.candidates.map((c) => c.candidateId)).toEqual(["b", "a", "c"]);
  });

  it("attaches the cross-scored variant when present", () => {
    const rows: RawScoreRow[] = [row({ candidate_id: "a", band: "SHORTLIST", total: 65 })];
    const other = new Map([
      ["a", row({ candidate_id: "a", rubric_variant: "spm", band: "HOLD", total: 55 })],
    ]);
    const result = buildRoleView("pm", rows, other, new Map(), new Map(), new Map());
    expect(result.candidates[0].crossScore).toEqual({ role: "spm", total: 55, band: "HOLD" });
  });

  it("surfaces the gate-fail reason when G1 did not pass", () => {
    const rows: RawScoreRow[] = [
      row({
        candidate_id: "a",
        band: "DECLINE_QUEUE",
        total: 30,
        gates: {
          g1: { passed: false, reason: "Below PM experience floor", flags: [] },
          g2: { flag: "CONFIRM IN FIRST REPLY" },
          g3: {},
          experience: {
            yearsProductOwnership: 0,
            yearsHandsOnOps: 0,
            foundingTeamProductWork: false,
            totalYearsPM: 0,
            ownedAreaWithoutSeniorPMAbove: false,
          },
        },
      }),
    ];
    const result = buildRoleView("pm", rows, new Map(), new Map(), new Map(), new Map());
    expect(result.candidates[0].gateReason).toBe("Below PM experience floor");
  });
});
