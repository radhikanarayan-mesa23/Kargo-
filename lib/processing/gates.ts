import type {
  Criteria,
  ExperienceFacts,
  GateResult,
  Role,
  RoutingResult,
} from "@/lib/processing/types";

/**
 * G1 -- experience floor, per role (rubric Section 2). Not a flat 3-year
 * rule: PM needs >=2 yrs owning product outcomes; SPM needs >=5 yrs PM with
 * at least one area owned without a senior PM above them. Near-misses are
 * flagged, not failed, and over-experienced candidates are flagged rather
 * than auto-failed -- Arjun decides both.
 */
export function applyExperienceGate(
  role: Role,
  facts: ExperienceFacts,
  criteria: Pick<Criteria, "c1" | "c2">,
): GateResult {
  const flags: string[] = [];

  if (role === "pm") {
    const meetsFloor =
      facts.yearsProductOwnership >= 2 || facts.foundingTeamProductWork;
    if (meetsFloor) {
      if (facts.yearsProductOwnership >= 6) {
        flags.push("possibly over-levelled");
      }
      return { passed: true, flags };
    }

    const isNearMiss =
      facts.yearsProductOwnership >= 1 &&
      facts.yearsProductOwnership < 2 &&
      facts.yearsHandsOnOps >= 2 &&
      criteria.c1.score >= 3;
    if (isNearMiss) {
      return {
        passed: true,
        nearMiss: true,
        flags: ["near-miss: <2yrs PM but strong hands-on ops (C1>=3)"],
      };
    }

    return {
      passed: false,
      reason: `Below PM experience floor (${facts.yearsProductOwnership} yrs product ownership, no founding-team product work)`,
      flags,
    };
  }

  // SPM
  const meetsFloor =
    facts.totalYearsPM >= 5 && facts.ownedAreaWithoutSeniorPMAbove;
  if (meetsFloor) {
    if (facts.totalYearsPM >= 10) {
      flags.push("possibly over-levelled");
    }
    return { passed: true, flags };
  }

  const isNearMiss =
    facts.totalYearsPM >= 3 &&
    facts.totalYearsPM < 5 &&
    criteria.c1.score >= 3 &&
    criteria.c2.score >= 3;
  if (isNearMiss) {
    return {
      passed: true,
      nearMiss: true,
      flags: ["near-miss: 3-5 yrs PM + C1>=3 + C2>=3 -> route to PM rubric"],
    };
  }

  return {
    passed: false,
    reason: `Below SPM experience floor (${facts.totalYearsPM} yrs PM, owned-without-senior-PM=${facts.ownedAreaWithoutSeniorPMAbove})`,
    flags,
  };
}

/**
 * G2 -- location. The rubric says never infer this from the CV; in this
 * system it's stronger than that, since street addresses are redacted
 * before the CV ever reaches the AI. There is nothing to infer from, so
 * this gate is a constant: always flag for Arjun to confirm, never fail,
 * never affect score.
 */
export function applyLocationGate(): { flag: "CONFIRM IN FIRST REPLY" } {
  return { flag: "CONFIRM IN FIRST REPLY" };
}

/**
 * G3 -- role routing (rubric Section 2). Decided from the primary scoring
 * pass's C1-C3 and experience facts; the caller uses this to decide whether
 * to make a second AI call scoring the other rubric variant.
 */
export function applyRoutingGate(
  role: Role,
  facts: ExperienceFacts,
  criteria: Pick<Criteria, "c1" | "c2" | "c3">,
  g1: GateResult,
): RoutingResult {
  if (role === "spm" && !g1.passed) {
    if (criteria.c1.score >= 3 && criteria.c2.score >= 3 && criteria.c3.score >= 2) {
      return {
        crossScoreRole: "pm",
        reason: "SPM failed G1 but scored high on C1-C3 -> rescore on PM rubric",
      };
    }
  }

  if (role === "pm" && facts.totalYearsPM >= 5) {
    return {
      crossScoreRole: "spm",
      reason: "PM with 5+ yrs PM experience -> also score on SPM for C4-SPM evidence",
    };
  }

  return {};
}
