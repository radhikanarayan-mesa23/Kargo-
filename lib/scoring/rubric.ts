// No "server-only" guard -- see anthropic-client.ts for why (also used by
// scripts/calibrate.ts outside Next's bundler).
import { readFileSync } from "fs";
import path from "path";
import type { Role } from "@/lib/processing/types";

let cachedRubricText: string | null = null;

function loadRubricText(): string {
  if (cachedRubricText) return cachedRubricText;
  const filePath = path.join(process.cwd(), "rubric", "kargo_hiring_rubric.txt");
  cachedRubricText = readFileSync(filePath, "utf-8");
  return cachedRubricText;
}

const JSON_SHAPE_INSTRUCTIONS = `
Return ONLY a single JSON object (no markdown fences, no commentary before or after) with exactly this shape:

{
  "c1": { "score": 0-4, "confidence": "H"|"M"|"L", "quotes": ["...verbatim CV line(s)..."] },
  "c2": { "score": 0-4, "confidence": "H"|"M"|"L", "quotes": ["..."] },
  "c3": { "score": 0-4, "confidence": "H"|"M"|"L", "quotes": ["..."] },
  "c4": { "score": 0-4, "confidence": "H"|"M"|"L", "quotes": ["..."] },
  "c5": { "score": 0-4, "confidence": "H"|"M"|"L", "quotes": ["..."] },
  "experience": {
    "yearsProductOwnership": number,
    "yearsHandsOnOps": number,
    "foundingTeamProductWork": boolean,
    "totalYearsPM": number,
    "ownedAreaWithoutSeniorPMAbove": boolean
  },
  "hiddenValue": [{ "item": "...", "quote": "..." }],
  "probes": ["...", "...", "..."],
  "risks": ["..."],
  "keyInsight": "one sentence weighing this candidate's raw JD/experience fit against the pattern-based signal (Patterns 1-3) that actually separated Kargo's Exceeds hires from Meets/Below hires -- name it explicitly when JD fit and pattern fit point in different directions, since Section 1 shows they often do (e.g. Vikram was the textbook JD match and rated Meets; Lavanya had less experience and rated Exceeds)."
}

Rules:
- Every "quotes" entry must be copied verbatim from the CV text below. If you
  cannot find a supporting line for a criterion, score it 0 and leave its
  quotes empty rather than inventing or paraphrasing evidence (Section 7,
  rule 1).
- "experience" fields are your best-effort structured read of years/ownership
  actually stated in the CV. Never invent a number that isn't grounded in
  what's written; use 0/false if genuinely unstated.
- "probes" must have exactly 3 entries, tied to the lowest or
  lowest-confidence criteria (Section 9).
- "risks" is a short list of what could make this candidate a Meets/Below
  hire rather than the Exceeds pattern (Section 9's RISKS field).
- Do not mention, infer, or use name, gender, age, location, or college/school
  names to influence any score (Section 6) -- these have already been
  redacted from the CV text below, so you should never see them anyway.
`.trim();

export function buildScoringSystemPrompt(variant: Role): string {
  const rubricText = loadRubricText();
  const variantNote =
    variant === "pm"
      ? "You are scoring this candidate against the PM rubric. Score C4 using the C4-PM anchors in Section 3."
      : "You are scoring this candidate against the SPM rubric. Score C4 using the C4-SPM anchors in Section 3.";

  return [
    "You are scoring a candidate's (redacted) CV against Kargo's hiring rubric below. The rubric is the sole source of criteria, weights, gates, and fairness rules -- do not invent additional criteria.",
    rubricText,
    variantNote,
    JSON_SHAPE_INSTRUCTIONS,
  ].join("\n\n");
}
