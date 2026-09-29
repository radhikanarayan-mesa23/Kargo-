export type Role = "pm" | "spm";
export type Band = "PRIORITY_SHORTLIST" | "SHORTLIST" | "HOLD" | "DECLINE_QUEUE";
export type Confidence = "H" | "M" | "L";

export interface CriterionResult {
  score: 0 | 1 | 2 | 3 | 4;
  quotes: string[];
  confidence: Confidence;
  risks: string[];
}

export type Criteria = Record<"c1" | "c2" | "c3" | "c4" | "c5", CriterionResult>;

export const WEIGHTS = { c1: 25, c2: 20, c3: 15, c4: 25, c5: 15 } as const;

/**
 * Experience facts the scorer extracts from the (redacted) CV, used only to
 * evaluate gates G1/G3 -- never scored directly. Location is deliberately
 * absent: street addresses are stripped before the CV ever reaches the AI,
 * so G2 can never be inferred and is always a flat "confirm" flag (see
 * applyLocationGate).
 */
export interface ExperienceFacts {
  yearsProductOwnership: number;
  yearsHandsOnOps: number;
  foundingTeamProductWork: boolean;
  totalYearsPM: number;
  ownedAreaWithoutSeniorPMAbove: boolean;
}

export interface GateResult {
  passed: boolean;
  reason?: string;
  nearMiss?: boolean;
  flags: string[];
}

export interface RoutingResult {
  crossScoreRole?: Role;
  reason?: string;
}

export interface RankInput {
  candidateId: string;
  band: Band;
  total: number;
  c1: number;
  c2: number;
  hiddenValueCount: number;
  recentHandsOnOpsMonths: number;
}
