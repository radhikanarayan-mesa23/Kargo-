import { z } from "zod";

export const DraftResponseSchema = z.object({
  briefMd: z.string(),
  subject: z.string(),
  bodyTemplate: z.string(),
});

export type DraftResponse = z.infer<typeof DraftResponseSchema>;
