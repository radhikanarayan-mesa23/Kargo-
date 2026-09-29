import { z } from "zod";

export const CriterionScoreSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  confidence: z.enum(["H", "M", "L"]),
  quotes: z.array(z.string()),
});

export const ExperienceFactsSchema = z.object({
  yearsProductOwnership: z.number().min(0),
  yearsHandsOnOps: z.number().min(0),
  foundingTeamProductWork: z.boolean(),
  totalYearsPM: z.number().min(0),
  ownedAreaWithoutSeniorPMAbove: z.boolean(),
});

export const HiddenValueItemSchema = z.object({
  item: z.string(),
  quote: z.string(),
});

export const ScoringResponseSchema = z.object({
  c1: CriterionScoreSchema,
  c2: CriterionScoreSchema,
  c3: CriterionScoreSchema,
  c4: CriterionScoreSchema,
  c5: CriterionScoreSchema,
  experience: ExperienceFactsSchema,
  hiddenValue: z.array(HiddenValueItemSchema),
  probes: z.array(z.string()).min(1).max(3),
  risks: z.array(z.string()),
  keyInsight: z.string(),
});

export type ScoringResponse = z.infer<typeof ScoringResponseSchema>;
