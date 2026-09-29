import { WEIGHTS, type Criteria } from "@/lib/processing/types";

/** Total = sum over criteria of (score / 4) * weight (rubric Section 3). */
export function computeWeightedTotal(criteria: Criteria): number {
  const total =
    (criteria.c1.score / 4) * WEIGHTS.c1 +
    (criteria.c2.score / 4) * WEIGHTS.c2 +
    (criteria.c3.score / 4) * WEIGHTS.c3 +
    (criteria.c4.score / 4) * WEIGHTS.c4 +
    (criteria.c5.score / 4) * WEIGHTS.c5;

  // Round to 1 decimal place to avoid noisy floating-point tails (e.g. 71.29999999999998).
  return Math.round(total * 10) / 10;
}

/**
 * Section 10's calibration score: C1, C2, C3, C5 only (max 75), excluding
 * C4 since the 8 past hires were in different roles and C4 is role-specific.
 */
export function computeRoleAgnosticTotal(
  criteria: Pick<Criteria, "c1" | "c2" | "c3" | "c5">,
): number {
  const total =
    (criteria.c1.score / 4) * WEIGHTS.c1 +
    (criteria.c2.score / 4) * WEIGHTS.c2 +
    (criteria.c3.score / 4) * WEIGHTS.c3 +
    (criteria.c5.score / 4) * WEIGHTS.c5;

  return Math.round(total * 10) / 10;
}
