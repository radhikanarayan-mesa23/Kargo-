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

// Regression: a real production resume ("ISHAAN ROY\tIshaan Roy" header
// pattern) leaked the candidate's real name completely unredacted, because
// the "first non-contact-looking line" heuristic latched onto an unrelated
// header line ("Bangalore, India | ...") from PDF text extracted in a
// scrambled order, and the actual name -- echoed in ALL CAPS + Title Case
// near the contact block -- was never found or redacted at all.
describe("redactCvText -- echoed-name header (real-world PDF extraction order)", () => {
  const echoedFixture = readFileSync(
    path.join(__dirname, "..", "fixtures", "synthetic-cv-echoed-name.txt"),
    "utf-8",
  );
  const contact = extractContact(echoedFixture);
  const redacted = redactCvText(echoedFixture, contact);

  it("prefers the echoed title-case name over a misleading first line", () => {
    expect(contact.name).toBe("Rahul Mehta");
  });

  it("captures both the ALL-CAPS and title-case forms as redaction candidates", () => {
    expect(contact.nameCandidates).toContain("RAHUL MEHTA");
    expect(contact.nameCandidates).toContain("Rahul Mehta");
  });

  it("redacts the name in every form it appears, including inside a LinkedIn slug", () => {
    expect(redacted.toLowerCase()).not.toContain("rahul");
    expect(redacted.toLowerCase()).not.toContain("mehta");
  });

  it("still redacts when the name is repeated on separate lines rather than tab-separated", () => {
    // Real layout (14_sneha_kulkarni.pdf): the template repeats the name
    // on four consecutive lines above the email, with no tab/pipe
    // separator -- an earlier fix keyed on "\t" and missed this entirely.
    const text = [
      "SUMMARY",
      "CORE SKILLS",
      "Pune / Mumbai",
      "Built a unified analytics dashboard for performance tracking.",
      "SNEHA KULKARNI",
      "Sneha Kulkarni",
      "sneha.k.synthetic@example.com",
      "+91 90491 23745",
      "linkedin.com/in/sneha-kulkarni",
    ].join("\n");
    const c = extractContact(text);
    const out = redactCvText(text, c);
    expect(c.name).toBe("Sneha Kulkarni");
    expect(out.toLowerCase()).not.toContain("sneha");
    expect(out.toLowerCase()).not.toContain("kulkarni");
  });

  it("still redacts when the name shares a line with the email", () => {
    // Real layout (pm_08_nishant_joshi.pdf): name and email on one line,
    // which a lines-before/after scan never inspected.
    const text = [
      "Nishant Joshi nishant.j.synthetic@example.com",
      "+91 98228 71056 · Mumbai",
      "linkedin.com/in/nishantjoshi-pm",
      "Professional Summary",
      "Product manager with 4 years of experience.",
    ].join("\n");
    const c = extractContact(text);
    const out = redactCvText(text, c);
    expect(c.name).toBe("Nishant Joshi");
    expect(out.toLowerCase()).not.toContain("nishant");
    expect(out.toLowerCase()).not.toContain("joshi");
  });

  it("picks the real name over an adjacent job title", () => {
    // Real layout (pm_04_virat_patel.pdf): the job title sits between the
    // name and the contact line, and kept winning the display name.
    const text = [
      "Virat Patel",
      "Product Manager",
      "+91 98792 66104 · virat.p.synthetic@example.com · linkedin.com/in/viratpatel-logistics",
      "Professional Summary",
    ].join("\n");
    const c = extractContact(text);
    expect(c.name).toBe("Virat Patel");
    expect(redactCvText(text, c).toLowerCase()).not.toContain("virat");
  });

  it("never treats a section heading as a name", () => {
    const text = ["SUMMARY", "someone.synthetic@example.com"].join("\n");
    expect(extractContact(text).name).not.toBe("SUMMARY");
  });

  it("does not over-redact unrelated narrative content elsewhere in the document", () => {
    // The misleading first line ("Bangalore, India | Remote") also gets
    // redacted as a name candidate -- harmless (it's not sensitive content
    // being lost, and stripping a city name is consistent with the
    // fairness rule against inferring location), but everything else must
    // survive untouched.
    expect(redacted).toContain("Co-Founder");
    expect(redacted).toContain("Built and scaled a marketplace platform end to end");
    expect(redacted).toContain("MBA");
    expect(redacted).toContain("2020");
  });
});
