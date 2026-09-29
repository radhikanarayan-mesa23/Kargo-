import { NextRequest, NextResponse } from "next/server";
import { getScoreContext, readDraftingContext } from "@/lib/drafting/get-score-context";
import { generateDraft } from "@/lib/drafting/generate-draft";
import { saveDraft, type DraftType } from "@/lib/db/drafts";
import type { Role } from "@/lib/processing/types";

/** Generates a fresh draft of the explicitly-requested type -- used when
 * Arjun chooses the other decision than the one recommended by band. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const candidateId = body?.candidateId;
  const type = body?.type as DraftType | undefined;
  if (typeof candidateId !== "string" || (type !== "invite" && type !== "decline")) {
    return NextResponse.json(
      { error: "candidateId and type ('invite' | 'decline') are required" },
      { status: 400 },
    );
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
