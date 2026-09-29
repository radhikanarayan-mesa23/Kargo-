import { describe, expect, it } from "vitest";
import { verifyQuote } from "@/lib/quote-verify/fuzzy-match";

const SOURCE = `
Product Manager, FreightCo (2022 - Present)
- Owned the carrier allocation module end to end; shipped a self-serve
  booking flow that users adopted without a mandated rollout.
- Personally resolved a live customs-hold incident overnight before the
  client noticed, then rebuilt the exception-triage checklist so the same
  failure mode could not recur.
`;

describe("verifyQuote", () => {
  it("verifies an exact quote", () => {
    const result = verifyQuote(
      "Personally resolved a live customs-hold incident overnight before the client noticed",
      SOURCE,
    );
    expect(result.verified).toBe(true);
    expect(result.similarity).toBeGreaterThanOrEqual(0.9);
  });

  it("verifies a quote with minor whitespace/line-break drift", () => {
    const result = verifyQuote(
      "Owned the carrier allocation module end to end; shipped a self-serve booking flow",
      SOURCE,
    );
    expect(result.verified).toBe(true);
  });

  it("rejects a fabricated quote not present in the source at all", () => {
    const result = verifyQuote(
      "Single-handedly negotiated a multi-year contract with a Fortune 500 carrier",
      SOURCE,
    );
    expect(result.verified).toBe(false);
    expect(result.similarity).toBeLessThan(0.9);
  });

  it("rejects an empty quote", () => {
    const result = verifyQuote("", SOURCE);
    expect(result.verified).toBe(false);
  });
});
