"use client";

import { useState } from "react";
import type { Band, Role } from "@/lib/processing/types";

export interface InterviewCardProps {
  candidateId: string;
  name: string;
  email: string;
  role: Role;
  total: number | null;
  band: Band | null;
  keyInsight: string;
  probes: string[];
  risks: string[];
  hiddenValue: { item: string; quote: string }[];
  resumeSummary: string | null;
  invitedAt: string;
}

const ROLE_LABELS: Record<Role, string> = {
  pm: "Product Manager",
  spm: "Senior PM",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Formatted manually in UTC rather than via toLocaleDateString, which
 * renders differently on the server and in the browser ("Sep 29" vs
 * "29 Sept") and caused a hydration mismatch. */
function formatInvitedDate(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The model returns plain markdown bullets; render them as a real list
 * instead of leaving literal "*" characters on screen. */
function NotesBody({ text }: { text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => /^[*-]\s+/.test(l)).map((l) => l.replace(/^[*-]\s+/, ""));

  if (bullets.length === 0) {
    return <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{text}</p>;
  }
  return (
    <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 text-sm text-ink-muted">
      {bullets.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

export default function InterviewCard(props: InterviewCardProps) {
  const [summary, setSummary] = useState(props.resumeSummary);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSummary(regenerate = false) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/interview-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: props.candidateId, regenerate }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setError(data.error ?? `Could not generate notes (HTTP ${res.status})`);
        return;
      }
      setSummary(data.summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const invited = formatInvitedDate(props.invitedAt);

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink">{props.name}</h3>
            <span className="rounded-pill bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
              Invited{invited ? ` · ${invited}` : ""}
            </span>
            <span className="rounded-pill bg-border/70 px-2.5 py-0.5 text-xs font-medium text-ink-muted">
              {ROLE_LABELS[props.role]}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{props.email}</p>
        </div>
        {props.total !== null && (
          <div className="shrink-0 text-right">
            <div className="text-2xl font-semibold tabular-nums text-ink">{props.total}</div>
            <div className="text-xs text-ink-muted">/ 100</div>
          </div>
        )}
      </div>

      {props.keyInsight && (
        <div className="mt-4 rounded-md border border-brand-tint bg-brand-tint/40 px-3.5 py-2.5 text-sm text-ink">
          <span className="font-display font-medium italic text-brand">Key insight&ensp;</span>
          {props.keyInsight}
        </div>
      )}

      <div className="mt-4 rounded-md bg-surface-canvas p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium text-ink">Interview notes</h4>
          {summary && (
            <button
              type="button"
              onClick={() => loadSummary(true)}
              disabled={pending}
              className="text-xs font-medium text-brand hover:text-brand-hover disabled:opacity-50"
            >
              {pending ? "Regenerating…" : "Regenerate"}
            </button>
          )}
        </div>

        {summary ? (
          <NotesBody text={summary} />
        ) : (
          <div className="mt-2">
            <p className="text-xs text-ink-muted">
              A short background summary of this candidate&apos;s CV, to read before the
              interview.
            </p>
            <button
              type="button"
              onClick={() => loadSummary(false)}
              disabled={pending}
              className="mt-2 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-hover disabled:opacity-50"
            >
              {pending ? "Generating…" : "Generate notes"}
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {(props.probes.length > 0 || props.risks.length > 0 || props.hiddenValue.length > 0) && (
        <details className="mt-3 rounded-md bg-surface-canvas p-3.5">
          <summary className="cursor-pointer text-sm font-medium text-ink">
            What to probe, and what to watch for
          </summary>

          {props.probes.length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Probes
              </h5>
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-sm text-ink-muted">
                {props.probes.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          {props.risks.length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Risks
              </h5>
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4 text-sm text-ink-muted">
                {props.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {props.hiddenValue.length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Hidden value
              </h5>
              <ul className="mt-1.5 flex flex-col gap-1 text-sm text-ink-muted">
                {props.hiddenValue.map((hv, i) => (
                  <li key={i}>
                    <span className="font-medium text-ink">{hv.item}</span>
                    {hv.quote && <span> &mdash; &ldquo;{hv.quote}&rdquo;</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}
    </div>
  );
}
