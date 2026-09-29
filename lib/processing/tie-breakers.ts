import type { Band, RankInput } from "@/lib/processing/types";

const BAND_RANK: Record<Band, number> = {
  PRIORITY_SHORTLIST: 0,
  SHORTLIST: 1,
  HOLD: 2,
  DECLINE_QUEUE: 3,
};

/**
 * Dashboard ordering: band, then total, then the Section 8 tie-breakers in
 * order (higher C1 -> higher C2 -> more Hidden Value items -> more recent
 * hands-on ops exposure). Ascending comparator (lower = ranked first).
 */
export function compareCandidatesForRanking(a: RankInput, b: RankInput): number {
  if (BAND_RANK[a.band] !== BAND_RANK[b.band]) {
    return BAND_RANK[a.band] - BAND_RANK[b.band];
  }
  if (a.total !== b.total) return b.total - a.total;
  if (a.c1 !== b.c1) return b.c1 - a.c1;
  if (a.c2 !== b.c2) return b.c2 - a.c2;
  if (a.hiddenValueCount !== b.hiddenValueCount) {
    return b.hiddenValueCount - a.hiddenValueCount;
  }
  return b.recentHandsOnOpsMonths - a.recentHandsOnOpsMonths;
}
