import { describe, expect, it } from "vitest";
import { substituteFirstName } from "@/lib/drafting/email-draft";

describe("substituteFirstName", () => {
  it("substitutes the first name from a full name", () => {
    expect(substituteFirstName("Hi {{first_name}}, welcome!", "Asha Verma")).toBe(
      "Hi Asha, welcome!",
    );
  });

  it("replaces every occurrence", () => {
    expect(substituteFirstName("{{first_name}}? {{first_name}}!", "Rohan Desai")).toBe(
      "Rohan? Rohan!",
    );
  });

  it("falls back to 'there' when no name is on file", () => {
    expect(substituteFirstName("Hi {{first_name}},", null)).toBe("Hi there,");
    expect(substituteFirstName("Hi {{first_name}},", "")).toBe("Hi there,");
  });
});
