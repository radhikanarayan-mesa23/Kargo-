import type { Band } from "@/lib/processing/types";
import type { DraftType } from "@/lib/db/drafts";

/** invite for PRIORITY SHORTLIST or SHORTLIST; decline for everything else
 * (DECLINE_QUEUE, and HOLD as a safe default until Arjun picks a side). */
export function recommendedDraftType(band: Band): DraftType {
  return band === "PRIORITY_SHORTLIST" || band === "SHORTLIST" ? "invite" : "decline";
}
