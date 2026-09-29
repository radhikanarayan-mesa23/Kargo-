import { NextRequest, NextResponse } from "next/server";
import { getScoreContext, readDraftingContext } from "@/lib/drafting/get-score-context";
import { recommendedDraftType } from "@/lib/drafting/recommended-type";
import { generateDraft } from "@/lib/drafting/generate-draft";
import { getLatestDraft, saveDraft } from "@/lib/db/drafts";
import type { Role } from "@/lib/processing/types";

/**
 * Generates (or returns the already-existing) brief + email draft of the
 * band-recommended type for a candidate. Idempotent -- viewing a card twice
 * doesn't burn a second AI call. Use /api/draft/regenerate to force the
 * other type on demand.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const candidateId = body?.candidateId;
  if (typeof candidateId !== "string") {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }
  const rubricVariant = body?.rubricVariant as Role | undefined;

  const context = await getScoreContext(candidateId, rubricVariant);
  if (!context) {
    return NextResponse.json({ error: "Candidate or score not found" }, { status: 404 });
  }
  if (!context.candidate.cv_text_redacted) {
    return NextResponse.json(
      { error: "Candidate has no extracted CV text" },
      { status: 422 },
    );
  }

  const type = recommendedDraftType(context.score.band);
  const existing = await getLatestDraft(candidateId, type);
  if (existing) {
    return NextResponse.json({ draft: existing, generated: false });
  }

  try {
    const draftingContext = readDraftingContext(context.score);
    const generated = await generateDraft({
      role: context.rubricVariant,
      draftType: type,
      cvTextRedacted: context.candidate.cv_text_redacted,
      ...draftingContext,
    });
    const saved = await saveDraft({
      candidateId,
      type,
      subject: generated.subject,
      bodyTemplate: generated.bodyTemplate,
      briefMd: generated.briefMd,
    });
    return NextResponse.json({ draft: saved, generated: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
