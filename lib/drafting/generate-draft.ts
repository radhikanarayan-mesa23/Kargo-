// No "server-only" guard -- consistent with lib/scoring/model-client.ts,
// kept importable from plain Node scripts too.
import { generateText, getScoringModel } from "@/lib/scoring/model-client";
import { DraftResponseSchema, type DraftResponse } from "@/lib/drafting/schema";
import type { DraftType } from "@/lib/db/drafts";
import type { Role } from "@/lib/processing/types";

const FIRST_NAME_PLACEHOLDER = "{{first_name}}";

function buildDraftingSystemPrompt(draftType: DraftType, role: Role): string {
  const schedulingUrl = process.env.SCHEDULING_URL;
  const schedulingNote = schedulingUrl
    ? `An interview scheduling link is available: ${schedulingUrl} -- include it in invite emails.`
    : "No scheduling link is configured yet -- tell the candidate someone will follow up to schedule.";

  const typeInstructions =
    draftType === "invite"
      ? `Write an INVITE email: warm, specific to the ${role.toUpperCase()} role at Kargo, inviting them to the next step (an interview). Reference something genuine and specific from their background (without using their name -- you don't have it) to show this isn't a form letter. ${schedulingNote}`
      : "Write a DECLINE email: courteous and specific to the role. It must NEVER mention scores, criteria, ratings, or reasons for the decision -- just a warm, professional decline that leaves the door open respectfully. Do not imply what was lacking.";

  return [
    "You are drafting an interview brief and one candidate email for Kargo's hiring process, based on a redacted CV and its rubric scoring context provided as the user message.",
    `The email body MUST include the literal placeholder ${FIRST_NAME_PLACEHOLDER} exactly once, where the candidate's first name will be substituted just before sending -- you do not know their real name and must never guess or invent one.`,
    typeInstructions,
    "Also write a markdown interview brief with sections '## Probes', '## Risks', and '## Hidden Value', expanding the scoring context's probes/risks/hidden-value bullets into a form an interviewer can read in under a minute.",
    'Return ONLY a JSON object of the shape { "briefMd": "...", "subject": "...", "bodyTemplate": "..." }. No markdown fences, no commentary before or after.',
  ].join("\n\n");
}

export interface GenerateDraftInput {
  role: Role;
  draftType: DraftType;
  cvTextRedacted: string;
  probes: string[];
  risks: string[];
  hiddenValue: { item: string; quote: string }[];
  keyInsight: string;
}

export async function generateDraft(input: GenerateDraftInput): Promise<DraftResponse> {
  const systemPrompt = buildDraftingSystemPrompt(input.draftType, input.role);
  const model = getScoringModel();

  const contextBlock = [
    "SCORING CONTEXT (never mention scores/criteria in a decline email):",
    `Key insight: ${input.keyInsight}`,
    `Probes: ${input.probes.join(" | ")}`,
    `Risks: ${input.risks.join(" | ") || "none"}`,
    `Hidden value: ${input.hiddenValue.map((h) => `${h.item} (${h.quote})`).join(" | ") || "none"}`,
    "",
    "REDACTED CV:",
    input.cvTextRedacted,
  ].join("\n");

  const rawText = await generateText(systemPrompt, contextBlock, model);
  const jsonText = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? rawText.trim();
  const parsed = DraftResponseSchema.parse(JSON.parse(jsonText));

  if (!parsed.bodyTemplate.includes(FIRST_NAME_PLACEHOLDER)) {
    throw new Error("Draft body is missing the required {{first_name}} placeholder");
  }

  return parsed;
}
