import { describe, expect, it } from "vitest";
import { getPreviouslyContacted } from "@/lib/dashboard/previously-contacted";

describe("getPreviouslyContacted", () => {
  it("returns an empty list for the header-only placeholder seed file", () => {
    // seed/previously_contacted.csv ships with just a header row until
    // Arjun fills it in -- this should never throw, just return [].
    expect(getPreviouslyContacted()).toEqual([]);
  });
});
