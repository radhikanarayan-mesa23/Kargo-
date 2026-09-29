import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { extractContact } from "@/lib/extraction/contact";
import { redactCvText } from "@/lib/redaction/redact";

const fixture = readFileSync(
  path.join(__dirname, "..", "fixtures", "synthetic-cv-1.txt"),
  "utf-8",
);

describe("extractContact", () => {
  it("pulls name, email, phone and urls from a synthetic CV", () => {
    const contact = extractContact(fixture);
    expect(contact.name).toBe("Asha Verma");
    expect(contact.email).toBe("asha.verma.synthetic@example.com");
    expect(contact.phone).toContain("98765");
    expect(contact.urls.some((u) => u.includes("linkedin.com"))).toBe(true);
  });
});

describe("redactCvText", () => {
  const contact = extractContact(fixture);
  const redacted = redactCvText(fixture, contact);

  it("removes the name everywhere it appears, case-insensitively", () => {
    expect(redacted.toLowerCase()).not.toContain("asha");
    expect(redacted.toLowerCase()).not.toContain("verma");
  });

  it("removes the email address as a single clean tag", () => {
    expect(redacted).not.toContain("asha.verma.synthetic@example.com");
    // Guards against the name-tokens-inside-the-email-local-part regression:
    // redacting "verma" before the email pattern runs fractures the match
    // into stray [REDACTED-NAME] fragments instead of one [REDACTED-EMAIL].
    expect(redacted.match(/\[REDACTED-EMAIL\]/g)).toHaveLength(1);
  });

  it("removes the phone number", () => {
    expect(redacted).not.toContain("98765 43210");
  });

  it("removes URLs", () => {
    expect(redacted.toLowerCase()).not.toContain("linkedin.com/in/asha-verma-synthetic");
  });

  it("removes the street address line", () => {
    expect(redacted).not.toContain("42 MG Road");
    expect(redacted).not.toContain("560001");
  });

  it("removes date of birth", () => {
    expect(redacted).not.toContain("14/03/1994");
  });

  it("removes the gender field", () => {
    expect(redacted.toLowerCase()).not.toMatch(/gender\s*:\s*female/);
  });

  it("blanks institution names in the education section, including trailing campus names", () => {
    expect(redacted).not.toContain("Indian Institute of Technology Bombay");
    expect(redacted).not.toContain("XLRI Jamshedpur");
    expect(redacted).not.toContain("Bombay");
    expect(redacted).not.toContain("Jamshedpur");
  });

  it("preserves degree keywords and years on education lines", () => {
    expect(redacted).toContain("B.Tech");
    expect(redacted).toContain("Computer Science");
    expect(redacted).toContain("2019");
    expect(redacted).toContain("PGDM");
    expect(redacted).toContain("2021");
  });

  it("does not over-redact narrative achievement text", () => {
    expect(redacted).toContain("carrier allocation module");
    expect(redacted).toContain("resolved a live customs-hold incident");
    expect(redacted).toContain("Product Manager");
  });
});
