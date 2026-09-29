import type { Band, GateResult } from "@/lib/processing/types";

/**
 * Bands (rubric Section 8). A hard gate fail (not a near-miss) always routes
 * to DECLINE_QUEUE with the gate's reason stated, regardless of total.
 */
export function assignBand(
  total: number,
  gate: GateResult,
): { band: Band; reason?: string } {
  if (!gate.passed) {
    return { band: "DECLINE_QUEUE", reason: gate.reason };
  }

  if (total >= 80) return { band: "PRIORITY_SHORTLIST" };
  if (total >= 60) return { band: "SHORTLIST" };
  if (total >= 45) return { band: "HOLD" };
  return { band: "DECLINE_QUEUE" };
}

/**
 * The HOLD band is only ever shown on the dashboard when a role's shortlist
 * (PRIORITY_SHORTLIST + SHORTLIST) has fewer than 5 names -- a UI-layer
 * concern, not a banding one, so it's a separate pure helper.
 */
export function isHoldVisible(shortlistCount: number): boolean {
  return shortlistCount < 5;
}
