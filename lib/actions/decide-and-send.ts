import "server-only";
import { findCandidateById, updateCandidateStatus } from "@/lib/db/candidates";
import { getLatestDecision, recordDecision, type DecisionType } from "@/lib/db/decisions";
import { findEmail, recordEmail } from "@/lib/db/emails";
import { getLatestDraft, saveDraft, type DraftType } from "@/lib/db/drafts";
import { substituteFirstName } from "@/lib/drafting/email-draft";
import { generateDraft } from "@/lib/drafting/generate-draft";
import { getScoreContext, readDraftingContext } from "@/lib/drafting/get-score-context";
import { sendEmail } from "@/lib/email/resend-client";
import type { Role } from "@/lib/processing/types";

export type DecideAndSendResult =
  | {
      ok: true;
      emailed: boolean;
      emailStatus?: "sent" | "failed";
      resendId?: string;
      emailError?: string;
    }
  | { ok: false; error: string; code: "not_found" | "already_sent" | "no_draft" | "internal" };

export interface DecideAndSendInput {
  candidateId: string;
  rubricVariant: Role;
  decision: DecisionType;
  note?: string;
  editedSubject?: string;
  editedBody?: string;
}

/**
 * The one place that ever calls Resend. Enforces, in code (not only the
 * UI): a decision row must exist before any email is attempted, and the
 * same (candidate, type) email can never be sent twice. Shared by
 * /api/send and /api/batch-decline so the guard logic exists exactly once.
 */
export async function decideAndSend(input: DecideAndSendInput): Promise<DecideAndSendResult> {
  const candidate = await findCandidateById(input.candidateId);
  if (!candidate) {
    return { ok: false, error: "Candidate not found", code: "not_found" };
  }

  if (input.decision === "hold") {
    await recordDecision(input.candidateId, "hold", input.note);
    await updateCandidateStatus(input.candidateId, "held");
    return { ok: true, emailed: false };
  }

  const type: DraftType = input.decision === "advance" ? "invite" : "decline";

  // Pre-check for a clear error message; the DB's UNIQUE(candidate_id, type)
  // constraint is the actual guarantee against a race sending it twice.
  const existingEmail = await findEmail(input.candidateId, type);
  if (existingEmail) {
    return {
      ok: false,
      error: `A ${type} email was already sent to this candidate`,
      code: "already_sent",
    };
  }

  let draft = await getLatestDraft(input.candidateId, type);
  if (!draft) {
    // Auto-generate on demand -- e.g. a batch-decline sweep may hit a
    // candidate whose card nobody has expanded yet.
    const context = await getScoreContext(input.candidateId, input.rubricVariant);
    if (!context || !context.candidate.cv_text_redacted) {
      return {
        ok: false,
        error: `No ${type} draft exists and no score context is available to generate one`,
        code: "no_draft",
      };
    }
    try {
      const draftingContext = readDraftingContext(context.score);
      const generated = await generateDraft({
        role: context.rubricVariant,
        draftType: type,
        cvTextRedacted: context.candidate.cv_text_redacted,
        ...draftingContext,
      });
      draft = await saveDraft({
        candidateId: input.candidateId,
        type,
        subject: generated.subject,
        bodyTemplate: generated.bodyTemplate,
        briefMd: generated.briefMd,
      });
    } catch (err) {
      return {
        ok: false,
        error: `Could not generate ${type} draft: ${(err as Error).message}`,
        code: "no_draft",
      };
    }
  }

  // Step 1: insert the decision row -- no email is ever sent without this
  // existing first (hard safety rule #3).
  const decisionRow = await recordDecision(input.candidateId, input.decision, input.note);

  // Step 2: verify it actually landed before doing anything else.
  const verified = await getLatestDecision(input.candidateId);
  if (!verified || verified.id !== decisionRow.id) {
    return {
      ok: false,
      error: "Decision row could not be verified after insert",
      code: "internal",
    };
  }

  // Step 3 was the findEmail check above, before the decision was even
  // recorded -- deliberately checked first so a duplicate-send attempt
  // never writes a redundant decision row either.

  const subject = input.editedSubject ?? draft.subject;
  const bodyTemplate = input.editedBody ?? draft.body_template;
  const html = substituteFirstName(bodyTemplate, candidate.name).replace(/\n/g, "<br />");

  // Step 4: send.
  const { mode, result } = await sendEmail({ to: candidate.email, subject, html });

  // Step 5: record the outcome -- success or failure, never silently dropped.
  try {
    await recordEmail({
      candidateId: input.candidateId,
      type,
      mode,
      resendId: result.resendId,
      status: result.ok ? "sent" : "failed",
      error: result.error,
    });
  } catch (err) {
    return {
      ok: false,
      error: `Email send finished but could not be recorded: ${(err as Error).message}`,
      code: "internal",
    };
  }

  await updateCandidateStatus(
    input.candidateId,
    input.decision === "advance" ? "advanced" : "declined",
  );

  return {
    ok: true,
    emailed: true,
    emailStatus: result.ok ? "sent" : "failed",
    resendId: result.resendId,
    emailError: result.error,
  };
}
