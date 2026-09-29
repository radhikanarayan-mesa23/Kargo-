// Deliberately no "server-only" guard: this module is also imported by
// scripts/calibrate.ts, a plain Node script outside Next's bundler, where
// that guard throws unconditionally (it only no-ops under Next's own build).
//
// Provider: Gemini (via @google/genai), per an explicit interim decision --
// the spec's original target is Anthropic (ANTHROPIC_API_KEY, SCORING_MODEL
// default "claude-sonnet-5"). This can be swapped back; the rest of the
// scoring/drafting code only depends on generateText() below, not on any
// provider-specific types.
import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

export function getScoringModel(): string {
  return process.env.SCORING_MODEL || "gemini-3.1-pro-preview";
}

export async function generateText(
  systemPrompt: string,
  userContent: string,
  model: string,
): Promise<string> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model,
    contents: userContent,
    config: {
      systemInstruction: systemPrompt,
      maxOutputTokens: 8192,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Model response contained no text content");
  }
  return text;
}
