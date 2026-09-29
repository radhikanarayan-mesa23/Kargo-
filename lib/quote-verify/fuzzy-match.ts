import { partial_ratio, token_set_ratio } from "fuzzball";

export interface QuoteVerificationResult {
  verified: boolean;
  similarity: number;
}

function normalizeForMatch(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Verifies an AI-cited evidence quote actually appears in the source (the
 * redacted CV text), guarding against fabricated or paraphrased "evidence."
 * Fuzzy rather than exact because the model may reproduce a quote with
 * minor whitespace/punctuation drift.
 */
export function verifyQuote(
  quote: string,
  sourceText: string,
  threshold = 0.9,
): QuoteVerificationResult {
  const normalizedQuote = normalizeForMatch(quote);
  const normalizedSource = normalizeForMatch(sourceText);

  if (!normalizedQuote) {
    return { verified: false, similarity: 0 };
  }

  if (normalizedSource.includes(normalizedQuote)) {
    return { verified: true, similarity: 1 };
  }

  const similarity =
    Math.max(
      partial_ratio(normalizedQuote, normalizedSource),
      token_set_ratio(normalizedQuote, normalizedSource),
    ) / 100;

  return { verified: similarity >= threshold, similarity };
}
