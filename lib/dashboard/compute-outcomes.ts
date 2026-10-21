import type { Band } from "@/lib/processing/types";

export type InterviewResult = "strong" | "mixed" | "weak" | "no_show";
export type OfferState = "none" | "made" | "accepted" | "turned_down";
export type TenureCheck = "exceeding" | "meeting" | "struggling" | "left";

/** One row per band: how the people the AI put here actually turned out. */
export interface BandConversion {
  band: Band;
  invited: number;
  interviewed: number;
  strong: number;
  offersMade: number;
  accepted: number;
  started: number;
  /** Of those with a 90-day check recorded, how many are meeting or exceeding. */
  workingOut: number;
  checked90d: number;
}

export interface OutcomeStats {
  byBand: BandConversion[];
  /** Candidates whose decision history contains a decline that is no longer
   * the latest decision -- i.e. Arjun went back and changed his mind. The
   * only false-negative signal the system can produce on its own. */
  reversedDeclines: number;
  /** Invited candidates with no outcome recorded at all. The honest
   * denominator: every rate below is computed only over what's been filled in. */
  awaitingOutcome: number;
  totalInvited: number;
}

export interface OutcomeInput {
  /** Invited candidates only -- the ones there can be an outcome for. */
  invited: { candidateId: string; band: Band | null }[];
  outcomeByCandidate: Map<
    string,
    {
      interviewResult: InterviewResult | null;
      offer: OfferState;
      startedOn: string | null;
      check90d: TenureCheck | null;
    }
  >;
  /** Every decision ever recorded, newest first within each candidate. */
  decisionsByCandidate: Map<string, { decision: "advance" | "hold" | "decline" }[]>;
}

const BAND_ORDER: Band[] = ["PRIORITY_SHORTLIST", "SHORTLIST", "HOLD", "DECLINE_QUEUE"];

function emptyConversion(band: Band): BandConversion {
  return {
    band,
    invited: 0,
    interviewed: 0,
    strong: 0,
    offersMade: 0,
    accepted: 0,
    started: 0,
    workingOut: 0,
    checked90d: 0,
  };
}

/**
 * Turns recorded outcomes into the one thing the dashboard could not say
 * before: whether a band means anything. If PRIORITY_SHORTLIST and SHORTLIST
 * convert at the same rate, the threshold between them is noise.
 *
 * Pure, so it can be unit-tested without Supabase -- the caller fetches.
 */
export function computeOutcomes(input: OutcomeInput): OutcomeStats {
  const byBand = new Map<Band, BandConversion>(
    BAND_ORDER.map((b) => [b, emptyConversion(b)]),
  );

  let awaitingOutcome = 0;

  for (const c of input.invited) {
    // A candidate with no score row can't be attributed to a band; they
    // still count in totalInvited but not in any band's rates.
    const bucket = c.band ? byBand.get(c.band) : undefined;
    if (bucket) bucket.invited++;

    const o = input.outcomeByCandidate.get(c.candidateId);
    if (!o) {
      awaitingOutcome++;
      continue;
    }

    if (!bucket) continue;

    // "Interviewed" means the interview actually happened -- a no-show is
    // recorded but is not an interview.
    if (o.interviewResult && o.interviewResult !== "no_show") {
      bucket.interviewed++;
      if (o.interviewResult === "strong") bucket.strong++;
    }
    if (o.offer === "made" || o.offer === "accepted" || o.offer === "turned_down") {
      bucket.offersMade++;
    }
    if (o.offer === "accepted") bucket.accepted++;
    if (o.startedOn) bucket.started++;
    if (o.check90d) {
      bucket.checked90d++;
      if (o.check90d === "exceeding" || o.check90d === "meeting") bucket.workingOut++;
    }
  }

  let reversedDeclines = 0;
  for (const decisions of input.decisionsByCandidate.values()) {
    if (decisions.length < 2) continue;
    const [latest, ...earlier] = decisions;
    if (latest.decision !== "decline" && earlier.some((d) => d.decision === "decline")) {
      reversedDeclines++;
    }
  }

  return {
    byBand: BAND_ORDER.map((b) => byBand.get(b)!).filter((c) => c.invited > 0),
    reversedDeclines,
    awaitingOutcome,
    totalInvited: input.invited.length,
  };
}

/** Rate helper that refuses to invent a number from an empty denominator. */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 100);
}
