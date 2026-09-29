// No "server-only" guard -- see model-client.ts for why (also used by
// scripts/calibrate.ts outside Next's bundler).
import { generateText, getScoringModel } from "@/lib/scoring/model-client";
import { buildScoringSystemPrompt } from "@/lib/scoring/rubric";
import { ScoringResponseSchema, type ScoringResponse } from "@/lib/scoring/schema";
import { verifyQuote } from "@/lib/quote-verify/fuzzy-match";
import type { Criteria, ExperienceFacts, Role } from "@/lib/processing/types";

export interface ScoredVariant {
  criteria: Criteria;
  experience: ExperienceFacts;
  hiddenValue: { item: string; quote: string }[];
  probes: string[];
  risks: { overall: string[]; byCriterion: Record<keyof Criteria, string[]> };
  keyInsight: string;
  model: string;
}

export type ScoreCandidateResult =
  | { ok: true; variant: ScoredVariant }
  | { ok: false; reason: string };

function extractJsonPayload(text: string): string {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) return fencedMatch[1].trim();
  return text.trim();
}

/** Verifies every quote for one criterion; unverified quotes are reported so the
 * criterion can be forced to 0 and flagged, per rubric Section 7 rule 1. */
function verifyCriterionQuotes(
  quotes: string[],
  cvTextRedacted: string,
): { allVerified: boolean; unverified: string[] } {
  const unverified: string[] = [];
  for (const quote of quotes) {
    const { verified } = verifyQuote(quote, cvTextRedacted);
    if (!verified) unverified.push(quote);
  }
  return { allVerified: unverified.length === 0, unverified };
}

function buildCriteria(
  parsed: ScoringResponse,
  cvTextRedacted: string,
): { criteria: Criteria; byCriterion: Record<keyof Criteria, string[]> } {
  const keys: (keyof Criteria)[] = ["c1", "c2", "c3", "c4", "c5"];
  const criteria = {} as Criteria;
  const byCriterion = {} as Record<keyof Criteria, string[]>;

  for (const key of keys) {
    const raw = parsed[key];
    const { allVerified, unverified } = verifyCriterionQuotes(raw.quotes, cvTextRedacted);

    const risks: string[] = [];
    let score = raw.score;

    if (raw.quotes.length > 0 && !allVerified) {
      score = 0;
      risks.push("unverified quote");
    }

    criteria[key] = {
      score: score as 0 | 1 | 2 | 3 | 4,
      quotes: raw.quotes,
      confidence: raw.confidence,
      risks,
    };
    byCriterion[key] = unverified.length > 0 ? unverified : [];
  }

  return { criteria, byCriterion };
}

/**
 * Scores one candidate against one rubric variant (pm or spm). Retries once
 * on invalid JSON; a second failure is reported to the caller so it can set
 * status = "needs_review" rather than silently persisting nothing. A network
 * or API failure is not retried here -- it's surfaced immediately.
 */
export async function scoreCandidateWithAI(
  role: Role,
  cvTextRedacted: string,
): Promise<ScoreCandidateResult> {
  const systemPrompt = buildScoringSystemPrompt(role);
  const model = getScoringModel();

  let lastError = "unknown error";

  for (let attempt = 0; attempt < 2; attempt++) {
    let rawText: string;
    try {
      rawText = await generateText(systemPrompt, cvTextRedacted, model);
    } catch (err) {
      return { ok: false, reason: `Model call failed: ${(err as Error).message}` };
    }

    try {
      const jsonPayload = extractJsonPayload(rawText);
      const parsedJson = JSON.parse(jsonPayload);
      const parsed = ScoringResponseSchema.parse(parsedJson);
      const { criteria, byCriterion } = buildCriteria(parsed, cvTextRedacted);

      return {
        ok: true,
        variant: {
          criteria,
          experience: parsed.experience,
          hiddenValue: parsed.hiddenValue,
          probes: parsed.probes,
          risks: { overall: parsed.risks, byCriterion },
          keyInsight: parsed.keyInsight,
          model,
        },
      };
    } catch (err) {
      lastError = `Invalid JSON from model (attempt ${attempt + 1}): ${(err as Error).message}`;
    }
  }

  return { ok: false, reason: lastError };
}
