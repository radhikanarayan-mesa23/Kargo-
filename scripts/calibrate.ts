/**
 * Checkpoint B: scores the 8 past-hire fixtures in hires/ and prints the
 * Section 10 calibration table. Exits non-zero (and refuses to say PASS) if
 * any Exceeds-rated hire scores below any Meets/Below-rated hire on the
 * role-agnostic (C1/C2/C3/C5, max 75) scale -- per the build plan, that
 * failure must stop the build before moving on to the dashboard.
 *
 * Usage: npx tsx scripts/calibrate.ts   (needs ANTHROPIC_API_KEY; loads .env.local)
 */
import { readdirSync, readFileSync } from "fs";
import path from "path";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // No .env.local -- assume the environment already has ANTHROPIC_API_KEY set.
}

import { scoreCandidateWithAI } from "@/lib/scoring/score-candidate";
import { computeRoleAgnosticTotal } from "@/lib/processing/total";

const EXPECTED_RATING: Record<string, "Exceeds" | "Meets" | "Below"> = {
  rohan: "Exceeds",
  sunita: "Exceeds",
  aditya: "Exceeds",
  meghna: "Exceeds",
  lavanya: "Exceeds",
  vikram: "Meets",
  rahul: "Meets",
  preetham: "Below",
};

interface Row {
  name: string;
  rating: "Exceeds" | "Meets" | "Below";
  c1: number;
  c2: number;
  c3: number;
  c5: number;
  total: number;
}

async function main() {
  const hiresDir = path.join(process.cwd(), "hires");
  const files = readdirSync(hiresDir).filter((f) => f.endsWith(".txt"));

  if (files.length === 0) {
    console.error(`No .txt fixtures found in ${hiresDir}. See hires/README.md.`);
    process.exit(1);
  }

  const rows: Row[] = [];

  for (const file of files) {
    const name = path.basename(file, ".txt");
    const expectedRating = EXPECTED_RATING[name];
    if (!expectedRating) {
      console.warn(`Skipping ${file}: no expected rating registered for "${name}"`);
      continue;
    }

    const text = readFileSync(path.join(hiresDir, file), "utf-8");
    // Role choice doesn't affect C1/C2/C3/C5 -- only C4 (excluded here) is
    // variant-specific, so "pm" is used uniformly for the calibration pass.
    const result = await scoreCandidateWithAI("pm", text);

    if (!result.ok) {
      console.error(`Scoring failed for ${name}: ${result.reason}`);
      process.exit(1);
    }

    const { c1, c2, c3, c5 } = result.variant.criteria;
    const total = computeRoleAgnosticTotal({ c1, c2, c3, c5 });

    rows.push({ name, rating: expectedRating, c1: c1.score, c2: c2.score, c3: c3.score, c5: c5.score, total });
  }

  rows.sort((a, b) => b.total - a.total);

  console.log("\nSECTION 10 CALIBRATION CHECK (role-agnostic: C1, C2, C3, C5 / 75)\n");
  console.log("Name       C1  C2  C3  C5   Score/75   Rating");
  console.log("---------  --  --  --  --   --------   -------");
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(9)}  ${String(row.c1).padStart(2)}  ${String(row.c2).padStart(2)}  ` +
        `${String(row.c3).padStart(2)}  ${String(row.c5).padStart(2)}   ${row.total.toFixed(1).padStart(6)}     ${row.rating}`,
    );
  }

  const exceedsTotals = rows.filter((r) => r.rating === "Exceeds").map((r) => r.total);
  const othersTotals = rows.filter((r) => r.rating !== "Exceeds").map((r) => r.total);

  if (exceedsTotals.length === 0 || othersTotals.length === 0) {
    console.error("\nNeed at least one Exceeds hire and one Meets/Below hire to calibrate.");
    process.exit(1);
  }

  const minExceeds = Math.min(...exceedsTotals);
  const maxOthers = Math.max(...othersTotals);
  const minExceedsRow = rows.find((r) => r.rating === "Exceeds" && r.total === minExceeds)!;
  const maxOthersRow = rows.find((r) => r.rating !== "Exceeds" && r.total === maxOthers)!;

  console.log();
  if (minExceeds > maxOthers) {
    console.log(
      `PASS: lowest Exceeds (${minExceedsRow.name}, ${minExceeds}) > highest Meets/Below (${maxOthersRow.name}, ${maxOthers}).`,
    );
  } else {
    console.error(
      `FAIL: ${maxOthersRow.name} (${maxOthersRow.rating}, ${maxOthers}) scores >= ${minExceedsRow.name} (Exceeds, ${minExceeds}). ` +
        "Stopping here per the build plan -- do not proceed to the dashboard until this is resolved.",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
