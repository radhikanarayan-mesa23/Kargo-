/**
 * Redaction safety check against a folder of real CV PDFs.
 *
 * Unit tests use synthetic fixtures, which is exactly how three separate
 * PII leaks reached production unnoticed: real resume PDFs extract their
 * text in orders that don't match the visual layout, and every template
 * does it differently. This runs the real extraction + redaction path over
 * a whole folder and fails loudly if a candidate's name survives into the
 * text that would be sent to the AI.
 *
 * Names are inferred from filenames (e.g. "pm_08_nishant_joshi.pdf" =>
 * nishant, joshi), so point it at a folder named that way.
 *
 * Usage: npx tsx scripts/verify-redaction.ts <folder-of-pdfs>
 */
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";
import { extractContact } from "@/lib/extraction/contact";
import { redactCvText } from "@/lib/redaction/redact";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: npx tsx scripts/verify-redaction.ts <folder-of-pdfs>");
  process.exit(1);
}

/** Name tokens implied by the filename, ignoring role prefixes and indices. */
function expectedTokens(file: string): string[] {
  return path
    .basename(file, ".pdf")
    .split(/[_-]/)
    .filter((p) => p.length > 2 && !/^\d+$/.test(p) && !["pm", "spm", "cv", "resume"].includes(p.toLowerCase()));
}

async function main() {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
  if (files.length === 0) {
    console.error(`No PDFs found in ${dir}`);
    process.exit(1);
  }

  const leaks: string[] = [];
  const wrongNames: string[] = [];

  for (const file of files) {
    const parser = new PDFParse({ data: readFileSync(path.join(dir, file)) });
    let rawText: string;
    try {
      rawText = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }

    const contact = extractContact(rawText);
    const redacted = redactCvText(rawText, contact);
    const tokens = expectedTokens(file);

    const leaked = tokens.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(redacted));
    if (leaked.length > 0) leaks.push(`${file}: ${leaked.join(", ")}`);

    const nameOk = tokens.every((t) => (contact.name ?? "").toLowerCase().includes(t.toLowerCase()));
    if (!nameOk) wrongNames.push(`${file}: got ${JSON.stringify(contact.name)}`);
  }

  console.log(`\nChecked ${files.length} CVs`);
  console.log(`  PII leaks:          ${leaks.length}`);
  console.log(`  Wrong display name: ${wrongNames.length}`);

  if (wrongNames.length > 0) {
    console.log("\nWrong display names (not a leak, but Arjun sees the wrong label):");
    for (const w of wrongNames) console.log(`  ${w}`);
  }

  if (leaks.length > 0) {
    console.error("\nFAIL -- a candidate's name survived into the text sent to the AI:");
    for (const l of leaks) console.error(`  ${l}`);
    process.exit(1);
  }

  console.log("\nPASS -- no candidate name reached the redacted text.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
