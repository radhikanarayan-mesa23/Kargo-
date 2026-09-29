import { describe, expect, it } from "vitest";
import { applyExperienceGate, applyLocationGate, applyRoutingGate } from "@/lib/processing/gates";
import type { Criteria, ExperienceFacts } from "@/lib/processing/types";

function criterion(score: 0 | 1 | 2 | 3 | 4): Criteria["c1"] {
  return { score, quotes: [], confidence: "H", risks: [] };
}

function facts(overrides: Partial<ExperienceFacts> = {}): ExperienceFacts {
  return {
    yearsProductOwnership: 0,
    yearsHandsOnOps: 0,
    foundingTeamProductWork: false,
    totalYearsPM: 0,
    ownedAreaWithoutSeniorPMAbove: false,
    ...overrides,
  };
}

describe("applyExperienceGate (G1)", () => {
  it("PM passes at >=2 yrs product ownership", () => {
    const result = applyExperienceGate("pm", facts({ yearsProductOwnership: 2 }), {
      c1: criterion(2),
      c2: criterion(2),
    });
    expect(result.passed).toBe(true);
    expect(result.nearMiss).toBeFalsy();
  });

  it("PM passes via founding-team product work even with 0 formal PM years", () => {
    const result = applyExperienceGate(
      "pm",
      facts({ yearsProductOwnership: 0, foundingTeamProductWork: true }),
      { c1: criterion(2), c2: criterion(2) },
    );
    expect(result.passed).toBe(true);
  });

  it("PM near-miss: 1-2 yrs PM + >=2 yrs hands-on ops + C1>=3 flags rather than fails", () => {
    const result = applyExperienceGate(
      "pm",
      facts({ yearsProductOwnership: 1.5, yearsHandsOnOps: 2 }),
      { c1: criterion(3), c2: criterion(2) },
    );
    expect(result.passed).toBe(true);
    expect(result.nearMiss).toBe(true);
  });

  it("PM fails below the floor with no near-miss qualifiers", () => {
    const result = applyExperienceGate("pm", facts({ yearsProductOwnership: 0.5 }), {
      c1: criterion(1),
      c2: criterion(0),
    });
    expect(result.passed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("PM flags 'possibly over-levelled' rather than failing an over-experienced candidate", () => {
    const result = applyExperienceGate("pm", facts({ yearsProductOwnership: 8 }), {
      c1: criterion(3),
      c2: criterion(3),
    });
    expect(result.passed).toBe(true);
    expect(result.flags).toContain("possibly over-levelled");
  });

  it("SPM passes at >=5 yrs PM with an area owned without a senior PM above", () => {
    const result = applyExperienceGate(
      "spm",
      facts({ totalYearsPM: 5, ownedAreaWithoutSeniorPMAbove: true }),
      { c1: criterion(3), c2: criterion(3) },
    );
    expect(result.passed).toBe(true);
  });

  it("SPM near-miss: 3-5 yrs PM + C1>=3 + C2>=3 routes rather than fails", () => {
    const result = applyExperienceGate("spm", facts({ totalYearsPM: 4 }), {
      c1: criterion(3),
      c2: criterion(3),
    });
    expect(result.passed).toBe(true);
    expect(result.nearMiss).toBe(true);
  });

  it("SPM fails below floor without the near-miss qualifiers", () => {
    const result = applyExperienceGate("spm", facts({ totalYearsPM: 2 }), {
      c1: criterion(1),
      c2: criterion(1),
    });
    expect(result.passed).toBe(false);
  });
});

describe("applyLocationGate (G2)", () => {
  it("always returns the confirm flag -- location is never inferred (addresses are redacted before the AI ever sees the CV)", () => {
    expect(applyLocationGate()).toEqual({ flag: "CONFIRM IN FIRST REPLY" });
  });
});

describe("applyRoutingGate (G3)", () => {
  it("routes an SPM applicant who fails G1 but scores high on C1-C3 to the PM rubric", () => {
    const g1Fail = applyExperienceGate("spm", facts({ totalYearsPM: 1 }), {
      c1: criterion(3),
      c2: criterion(3),
    });
    const routing = applyRoutingGate(
      "spm",
      facts({ totalYearsPM: 1 }),
      { c1: criterion(3), c2: criterion(3), c3: criterion(2) },
      g1Fail,
    );
    expect(routing.crossScoreRole).toBe("pm");
  });

  it("routes a PM applicant with 5+ yrs PM experience to also score on SPM", () => {
    const g1Pass = applyExperienceGate("pm", facts({ yearsProductOwnership: 6 }), {
      c1: criterion(3),
      c2: criterion(3),
    });
    const routing = applyRoutingGate(
      "pm",
      facts({ totalYearsPM: 5 }),
      { c1: criterion(3), c2: criterion(3), c3: criterion(3) },
      g1Pass,
    );
    expect(routing.crossScoreRole).toBe("spm");
  });

  it("does not route when no routing condition is met", () => {
    const g1Pass = applyExperienceGate("pm", facts({ yearsProductOwnership: 2 }), {
      c1: criterion(2),
      c2: criterion(2),
    });
    const routing = applyRoutingGate(
      "pm",
      facts({ totalYearsPM: 2 }),
      { c1: criterion(2), c2: criterion(2), c3: criterion(2) },
      g1Pass,
    );
    expect(routing.crossScoreRole).toBeUndefined();
  });
});
