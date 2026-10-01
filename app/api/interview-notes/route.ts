import { NextRequest, NextResponse } from "next/server";
import { findCandidateById, setResumeSummary } from "@/lib/db/candidates";
import { generateResumeSummary } from "@/lib/interview/generate-summary";

export const maxDuration = 60;

/**
 * Generates (or returns the cached) resume summary used as interview
 * notes. Idempotent by default so opening the Interviews tab doesn't burn
 * an AI call per candidate per view; pass regenerate:true to force a
 * fresh one.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const candidateId = body?.candidateId;
  if (typeof candidateId !== "string") {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  const candidate = await findCandidateById(candidateId);
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }
  if (!candidate.cv_text_redacted) {
    return NextResponse.json(
      { error: "Candidate has no extracted CV text" },
      { status: 422 },
    );
  }

  if (candidate.resume_summary && body?.regenerate !== true) {
    return NextResponse.json({ summary: candidate.resume_summary, generated: false });
  }

  try {
    const summary = await generateResumeSummary(candidate.cv_text_redacted);
    await setResumeSummary(candidateId, summary);
    return NextResponse.json({ summary, generated: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
