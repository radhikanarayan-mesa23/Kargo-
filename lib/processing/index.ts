import { applyExperienceGate, applyLocationGate, applyRoutingGate } from "@/lib/processing/gates";
import { computeRoleAgnosticTotal, computeWeightedTotal } from "@/lib/processing/total";
import { assignBand, isHoldVisible } from "@/lib/processing/bands";
import { compareCandidatesForRanking } from "@/lib/processing/tie-breakers";
import type {
  Band,
  Criteria,
  ExperienceFacts,
  GateResult,
  Role,
  RoutingResult,
} from "@/lib/processing/types";

export * from "@/lib/processing/types";
export {
  applyExperienceGate,
  applyLocationGate,
  applyRoutingGate,
  computeWeightedTotal,
  computeRoleAgnosticTotal,
  assignBand,
  isHoldVisible,
  compareCandidatesForRanking,
};

export interface RawScoreInput {
  role: Role;
  criteria: Criteria;
  experience: ExperienceFacts;
}

export interface ProcessedScore {
  total: number;
  band: Band;
  gates: {
    g1: GateResult;
    g2: ReturnType<typeof applyLocationGate>;
    g3: RoutingResult;
  };
  reason: string;
}

const CRITERION_LABELS: Record<keyof Criteria, string> = {
  c1: "having lived the customer's job",
  c2: "live-fire ownership",
  c3: "an unprompted build others adopted",
  c4: "role capability",
  c5: "operating well without structure",
};

const BAND_LABELS: Record<Band, string> = {
  PRIORITY_SHORTLIST: "Priority Shortlist",
  SHORTLIST: "Shortlist",
  HOLD: "Hold",
  DECLINE_QUEUE: "Decline Queue",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function buildWhyRankedHere(criteria: Criteria, total: number, band: Band): string {
  const keys = Object.keys(criteria) as (keyof Criteria)[];
  const sorted = [...keys].sort((a, b) => criteria[b].score - criteria[a].score);
  const strongest = sorted.slice(0, 2).filter((k) => criteria[k].score >= 3);
  const weakest = sorted[sorted.length - 1];

  const strongestText = strongest.length
    ? strongest.map((k) => CRITERION_LABELS[k]).join(" and ")
    : "no single criterion standing out";

  const sentence1 = `Scored ${total}/100 (${BAND_LABELS[band]}), driven mainly by ${strongestText}.`;
  const sentence2 = `${capitalize(CRITERION_LABELS[weakest])} is the biggest gap, at ${criteria[weakest].score}/4.`;

  return `${sentence1} ${sentence2}`;
}

/**
 * Orchestrates gates -> total -> band -> "why ranked here" for one scored
 * variant. Pure: no I/O, no AI call -- everything it needs is passed in.
 */
export function processCandidateScore(input: RawScoreInput): ProcessedScore {
  const g1 = applyExperienceGate(input.role, input.experience, {
    c1: input.criteria.c1,
    c2: input.criteria.c2,
  });
  const g2 = applyLocationGate();
  const g3 = applyRoutingGate(
    input.role,
    input.experience,
    { c1: input.criteria.c1, c2: input.criteria.c2, c3: input.criteria.c3 },
    g1,
  );

  const total = computeWeightedTotal(input.criteria);
  const { band, reason: gateReason } = assignBand(total, g1);
  const reason = gateReason ?? buildWhyRankedHere(input.criteria, total, band);

  return { total, band, gates: { g1, g2, g3 }, reason };
}
