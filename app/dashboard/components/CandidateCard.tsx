"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Band, Confidence, Role } from "@/lib/processing/types";

export interface CriterionView {
  key: string;
  label: string;
  score: 0 | 1 | 2 | 3 | 4;
  confidence: Confidence;
  quotes: string[];
}

export type EmailType = "invite" | "decline";
export type DecisionType = "advance" | "hold" | "decline";

export interface CandidateCardProps {
  candidateId: string;
  rubricVariant: Role;
  name: string;
  band: Band;
  total: number;
  reason: string;
  keyInsight: string;
  criteria: CriterionView[];
  hiddenValue: { item: string; quote: string }[];
  locationFlag?: string;
  crossScore?: { role: Role; total: number; band: Band };
  decision: { decision: DecisionType } | null;
  emails: Partial<Record<EmailType, { status: string }>>;
  recommendedDraftType: EmailType;
  draft: { subject: string; bodyTemplate: string; briefMd: string } | null;
}

const BAND_STYLES: Record<Band, string> = {
  PRIORITY_SHORTLIST: "bg-brand text-white",
  SHORTLIST: "bg-success/10 text-success",
  HOLD: "bg-border/70 text-ink-muted",
  DECLINE_QUEUE: "bg-danger-tint text-danger",
};

const BAND_LABELS: Record<Band, string> = {
  PRIORITY_SHORTLIST: "Priority Shortlist",
  SHORTLIST: "Shortlist",
  HOLD: "Hold",
  DECLINE_QUEUE: "Decline Queue",
};

const CONFIDENCE_STYLES: Record<Confidence, string> = {
  H: "bg-success/10 text-success",
  M: "bg-brand-tint text-ink",
  L: "bg-border/70 text-ink-muted",
};

function ScoreDots({ score }: { score: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex gap-0.5" aria-label={`${score} out of 4`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i < score ? "bg-brand" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

export default function CandidateCard({
  candidateId,
  rubricVariant,
  name,
  band,
  total,
  reason,
  keyInsight,
  criteria,
  hiddenValue,
  locationFlag,
  crossScore,
  decision,
  emails,
  recommendedDraftType,
  draft,
}: CandidateCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.bodyTemplate ?? "");
  const [briefMd, setBriefMd] = useState(draft?.briefMd ?? "");
  const [draftType, setDraftType] = useState<EmailType>(recommendedDraftType);
  const [pending, setPending] = useState<null | DecisionType | "regenerate" | "draft">(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const inviteSent = emails.invite?.status === "sent";
  const declineSent = emails.decline?.status === "sent";

  /**
   * Loads the draft of the exact type requested, generating it if
   * necessary, and returns its content directly (not via closure state,
   * which may still hold the previous type mid-render). Guards against the
   * card ever sending one email type's content under another type's
   * decision -- e.g. clicking "Advance & send invite" while the editor is
   * showing a decline draft must never send the decline text as an invite.
   */
  async function loadDraftOfType(
    type: EmailType,
  ): Promise<{ subject: string; body: string; briefMd: string } | null> {
    if (draftType === type && (draft || subject)) {
      return { subject, body, briefMd };
    }

    setPending("draft");
    setActionError(null);
    try {
      const usesRecommendedEndpoint = type === recommendedDraftType;
      const res = await fetch(
        usesRecommendedEndpoint ? "/api/draft" : "/api/draft/regenerate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            usesRecommendedEndpoint
              ? { candidateId, rubricVariant }
              : { candidateId, rubricVariant, type },
          ),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Could not generate draft");
        return null;
      }
      setDraftType(type);
      setSubject(data.draft.subject);
      setBody(data.draft.body_template);
      setBriefMd(data.draft.brief_md);
      return {
        subject: data.draft.subject,
        body: data.draft.body_template,
        briefMd: data.draft.brief_md,
      };
    } catch (err) {
      setActionError((err as Error).message);
      return null;
    } finally {
      setPending(null);
    }
  }

  async function handleDecision(nextDecision: DecisionType) {
    setActionError(null);

    let subjectToSend: string | undefined;
    let bodyToSend: string | undefined;

    if (nextDecision !== "hold") {
      const neededType: EmailType = nextDecision === "advance" ? "invite" : "decline";
      const loaded = await loadDraftOfType(neededType);
      if (!loaded) return;
      subjectToSend = loaded.subject;
      bodyToSend = loaded.body;
    }

    setPending(nextDecision);
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          rubricVariant,
          decision: nextDecision,
          editedSubject: subjectToSend,
          editedBody: bodyToSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Action failed");
        return;
      }
      if (data.emailed && data.emailStatus === "failed") {
        setActionError(`Email send failed: ${data.emailError ?? "unknown error"}`);
      }
      router.refresh();
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  async function handleUseOtherType() {
    const otherType: EmailType = draftType === "invite" ? "decline" : "invite";
    const loaded = await loadDraftOfType(otherType);
    if (loaded) {
      setExpanded(true);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink">{name}</h3>
            <span
              className={`rounded-pill px-2.5 py-0.5 text-xs font-medium ${BAND_STYLES[band]}`}
            >
              {BAND_LABELS[band]}
            </span>
            {locationFlag && (
              <span className="rounded-pill bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-ink">
                {locationFlag}
              </span>
            )}
            {inviteSent && (
              <span className="rounded-pill bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                Invite sent
              </span>
            )}
            {declineSent && (
              <span className="rounded-pill bg-danger-tint px-2.5 py-0.5 text-xs font-medium text-danger">
                Decline sent
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm text-ink-muted">{reason}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-2xl font-semibold tabular-nums text-ink">{total}</div>
          <div className="text-xs text-ink-muted">/ 100</div>
        </div>
      </div>

      {keyInsight && (
        <div className="mt-4 rounded-md border border-brand-tint bg-brand-tint/40 px-3.5 py-2.5 text-sm text-ink">
          <span className="font-medium font-display italic text-brand">Key insight&ensp;</span>
          {keyInsight}
        </div>
      )}

      {crossScore && (
        <p className="mt-3 text-xs text-ink-muted">
          Also scored on the <span className="font-medium uppercase">{crossScore.role}</span>{" "}
          rubric: {crossScore.total}/100 ({BAND_LABELS[crossScore.band]})
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 text-sm font-medium text-brand hover:text-brand-hover"
      >
        {expanded ? "Hide details" : "Show scores, hidden value & brief"}
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {criteria.map((c) => (
              <div key={c.key} className="rounded-md bg-surface-canvas p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{c.label}</span>
                  <div className="flex items-center gap-2">
                    <ScoreDots score={c.score} />
                    <span
                      className={`rounded-pill px-1.5 py-0.5 text-[11px] font-medium ${CONFIDENCE_STYLES[c.confidence]}`}
                    >
                      {c.confidence}
                    </span>
                  </div>
                </div>
                {c.quotes.length > 0 ? (
                  <blockquote className="mt-1.5 border-l-2 border-brand-tint pl-2 text-xs italic text-ink-muted">
                    &ldquo;{c.quotes[0]}&rdquo;
                  </blockquote>
                ) : (
                  <p className="mt-1.5 text-xs text-ink-muted">No evidence in CV.</p>
                )}
              </div>
            ))}
          </div>

          {hiddenValue.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-ink">Hidden value</h4>
              <ul className="mt-1.5 flex flex-col gap-1">
                {hiddenValue.map((hv, i) => (
                  <li key={i} className="text-sm text-ink-muted">
                    <span className="font-medium text-ink">{hv.item}</span>
                    {hv.quote && <span> &mdash; &ldquo;{hv.quote}&rdquo;</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-md bg-surface-canvas p-3.5">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-medium text-ink">
                Email draft{" "}
                <span className="font-normal text-ink-muted">
                  ({draftType === "invite" ? "invite" : "decline"})
                </span>
              </h4>
              <button
                type="button"
                onClick={handleUseOtherType}
                disabled={pending !== null}
                className="text-xs font-medium text-brand hover:text-brand-hover disabled:opacity-50"
              >
                {pending === "regenerate"
                  ? "Generating…"
                  : `Use ${draftType === "invite" ? "decline" : "invite"} draft instead`}
              </button>
            </div>

            {draft || subject ? (
              <div className="mt-2 flex flex-col gap-2">
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                  className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand"
                />
                {briefMd && (
                  <details className="text-xs text-ink-muted">
                    <summary className="cursor-pointer font-medium text-ink">
                      Interview brief
                    </summary>
                    <pre className="mt-1.5 whitespace-pre-wrap font-sans">{briefMd}</pre>
                  </details>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink-muted">
                No draft generated yet &mdash; one will be created when you click a decision
                button below.
              </p>
            )}
          </div>
        </div>
      )}

      {actionError && (
        <p className="mt-3 rounded-md bg-danger-tint px-3 py-2 text-sm text-danger">
          {actionError}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => handleDecision("advance")}
          disabled={pending !== null || inviteSent}
          className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:opacity-50"
        >
          {pending === "advance"
            ? "Sending…"
            : inviteSent
              ? "Invite sent"
              : "Advance & send invite"}
        </button>
        <button
          type="button"
          onClick={() => handleDecision("hold")}
          disabled={pending !== null}
          className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink transition hover:bg-surface-canvas disabled:opacity-50"
        >
          {pending === "hold" ? "Saving…" : decision?.decision === "hold" ? "On hold" : "Hold"}
        </button>
        <button
          type="button"
          onClick={() => handleDecision("decline")}
          disabled={pending !== null || declineSent}
          className="rounded-md border border-danger/30 bg-surface px-3.5 py-2 text-sm font-medium text-danger transition hover:bg-danger-tint disabled:opacity-50"
        >
          {pending === "decline" ? "Sending…" : declineSent ? "Declined" : "Decline & send"}
        </button>
      </div>
    </div>
  );
}
