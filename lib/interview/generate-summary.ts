// No "server-only" guard -- consistent with the other model-calling
// modules, which stay importable from plain Node scripts.
import { generateText, getScoringModel } from "@/lib/scoring/model-client";

const SYSTEM_PROMPT = [
  "You are writing short interview notes for Arjun, the founder of Kargo (a logistics SaaS company), who is about to interview this candidate.",
  "You are given the candidate's CV with personal details already redacted. Summarise who this person is professionally, so Arjun can walk into the interview with context.",
  "Write 4-6 short bullet points covering: what they do now, the shape of their career so far, the domains/industries they've worked in, anything concrete they've built or owned, and anything genuinely distinctive.",
  "Stick to what the CV actually says -- never invent experience, employers, or numbers. If something is vague in the CV, leave it vague rather than embellishing.",
  "Do not speculate about the candidate's identity, gender, age, or location, and do not mention that anything was redacted.",
  "Do not score, rank, or recommend the candidate -- that is handled elsewhere. These notes are purely context.",
  "Return plain markdown bullets, no heading, no preamble.",
].join("\n\n");

export async function generateResumeSummary(cvTextRedacted: string): Promise<string> {
  const summary = await generateText(SYSTEM_PROMPT, cvTextRedacted, getScoringModel());
  return summary.trim();
}
