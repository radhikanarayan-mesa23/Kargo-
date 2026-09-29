import { describe, expect, it } from "vitest";
import { assignBand, isHoldVisible } from "@/lib/processing/bands";
import type { GateResult } from "@/lib/processing/types";

const PASS: GateResult = { passed: true, flags: [] };

describe("assignBand", () => {
  it("PRIORITY_SHORTLIST at 80 and above", () => {
    expect(assignBand(80, PASS).band).toBe("PRIORITY_SHORTLIST");
    expect(assignBand(95, PASS).band).toBe("PRIORITY_SHORTLIST");
    expect(assignBand(100, PASS).band).toBe("PRIORITY_SHORTLIST");
  });

  it("SHORTLIST from 60 up to (not including) 80", () => {
    expect(assignBand(60, PASS).band).toBe("SHORTLIST");
    expect(assignBand(79.9, PASS).band).toBe("SHORTLIST");
  });

  it("HOLD from 45 up to (not including) 60", () => {
    expect(assignBand(45, PASS).band).toBe("HOLD");
    expect(assignBand(59.9, PASS).band).toBe("HOLD");
  });

  it("DECLINE_QUEUE below 45", () => {
    expect(assignBand(44.9, PASS).band).toBe("DECLINE_QUEUE");
    expect(assignBand(0, PASS).band).toBe("DECLINE_QUEUE");
  });

  it("a hard gate fail always overrides total into DECLINE_QUEUE with the reason stated", () => {
    const failed: GateResult = { passed: false, reason: "Below PM experience floor", flags: [] };
    const result = assignBand(95, failed);
    expect(result.band).toBe("DECLINE_QUEUE");
    expect(result.reason).toBe("Below PM experience floor");
  });

  it("a near-miss gate (passed=true, nearMiss=true) is banded on total as normal", () => {
    const nearMiss: GateResult = { passed: true, nearMiss: true, flags: ["near-miss"] };
    expect(assignBand(85, nearMiss).band).toBe("PRIORITY_SHORTLIST");
  });
});

describe("isHoldVisible", () => {
  it("is visible when a role's shortlist has fewer than 5 names", () => {
    expect(isHoldVisible(0)).toBe(true);
    expect(isHoldVisible(4)).toBe(true);
  });

  it("is hidden once a role's shortlist reaches 5 or more", () => {
    expect(isHoldVisible(5)).toBe(false);
    expect(isHoldVisible(12)).toBe(false);
  });
});
