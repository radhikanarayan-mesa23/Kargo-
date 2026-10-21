"use client";

import { useRef, useState } from "react";

export type InterviewResult = "strong" | "mixed" | "weak" | "no_show";
export type OfferState = "none" | "made" | "accepted" | "turned_down";
export type TenureCheck = "exceeding" | "meeting" | "struggling" | "left";

export interface OutcomeTrackerProps {
  candidateId: string;
  interviewedOn: string | null;
  interviewResult: InterviewResult | null;
  offer: OfferState;
  startedOn: string | null;
  check90d: TenureCheck | null;
  note: string | null;
}

const RESULTS: { value: InterviewResult; label: string }[] = [
  { value: "strong", label: "Strong" },
  { value: "mixed", label: "Mixed" },
  { value: "weak", label: "Weak" },
  { value: "no_show", label: "No-show" },
];

const OFFERS: { value: OfferState; label: string }[] = [
  { value: "none", label: "No offer" },
  { value: "made", label: "Offer made" },
  { value: "accepted", label: "Accepted" },
  { value: "turned_down", label: "Turned down" },
];

const CHECKS: { value: TenureCheck; label: string }[] = [
  { value: "exceeding", label: "Exceeding" },
  { value: "meeting", label: "Meeting" },
  { value: "struggling", label: "Struggling" },
  { value: "left", label: "Left" },
];

/** A row of mutually-exclusive chips. Clicking the active one clears it,
 * because "I recorded this by mistake" is a thing that happens. */
function ChipRow<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onPick: (v: T | null) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(active ? null : o.value)}
            className={
              active
                ? "rounded-pill bg-brand px-2.5 py-1 text-xs font-medium text-white"
                : "rounded-pill border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-muted transition hover:border-brand hover:text-brand"
            }
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Where Arjun records what actually happened after the invite. Each control
 * saves on change rather than behind a Save button: these get filled in
 * weeks and months apart, and a half-finished form left unsaved is exactly
 * how outcome data stops existing.
 */
export default function OutcomeTracker(props: OutcomeTrackerProps) {
  const [interviewedOn, setInterviewedOn] = useState(props.interviewedOn ?? "");
  const [interviewResult, setInterviewResult] = useState(props.interviewResult);
  const [offer, setOffer] = useState<OfferState>(props.offer);
  const [startedOn, setStartedOn] = useState(props.startedOn ?? "");
  const [check90d, setCheck90d] = useState(props.check90d);
  const [note, setNote] = useState(props.note ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saves are queued rather than fired in parallel, and the controls stay
  // enabled while one is in flight. Disabling them during the request
  // silently swallowed a second quick click -- tick "Strong" then "Meeting"
  // in the same second and the second one never reached the database.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);

  function save(patch: Record<string, unknown>) {
    inFlight.current += 1;
    setSaving(true);
    setError(null);
    setSaved(false);

    queue.current = queue.current.then(async () => {
      try {
        const res = await fetch("/api/outcome", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: props.candidateId, ...patch }),
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) {
          setError(data.error ?? `Could not save (HTTP ${res.status})`);
          return;
        }
        setSaved(true);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        inFlight.current -= 1;
        if (inFlight.current === 0) setSaving(false);
      }
    });
  }

  const recorded =
    interviewResult !== null || offer !== "none" || startedOn !== "" || check90d !== null;

  return (
    <details className="mt-3 rounded-md bg-surface-canvas p-3.5" open={recorded}>
      <summary className="cursor-pointer text-sm font-medium text-ink">
        What happened
        {!recorded && (
          <span className="ml-2 font-normal text-ink-muted">· nothing recorded yet</span>
        )}
      </summary>

      <p className="mt-2 text-xs text-ink-muted">
        Fill these in as they happen. This is the only way to tell later whether the
        shortlist was any good.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Interview date
          </label>
          <input
            type="date"
            value={interviewedOn}
            onChange={(e) => {
              setInterviewedOn(e.target.value);
              void save({ interviewedOn: e.target.value });
            }}
            className="mt-1.5 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Start date
          </label>
          <input
            type="date"
            value={startedOn}
            onChange={(e) => {
              setStartedOn(e.target.value);
              void save({ startedOn: e.target.value });
            }}
            className="mt-1.5 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
          />
        </div>
      </div>

      <div className="mt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          How the interview went
        </span>
        <ChipRow
          options={RESULTS}
          value={interviewResult}
          onPick={(v) => {
            setInterviewResult(v);
            void save({ interviewResult: v ?? "" });
          }}
        />
      </div>

      <div className="mt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Offer
        </span>
        <ChipRow
          options={OFFERS}
          value={offer}
          onPick={(v) => {
            const next = v ?? "none";
            setOffer(next);
            void save({ offer: next });
          }}
        />
      </div>

      <div className="mt-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          90 days in
        </span>
        <ChipRow
          options={CHECKS}
          value={check90d}
          onPick={(v) => {
            setCheck90d(v);
            void save({ check90d: v ?? "" });
          }}
        />
      </div>

      <div className="mt-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          Note
        </label>
        <textarea
          value={note}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (note !== (props.note ?? "")) void save({ note });
          }}
          placeholder="Anything worth remembering about how this went."
          className="mt-1.5 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-ink"
        />
      </div>

      <div className="mt-2 min-h-5 text-xs">
        {error && <span className="text-danger">{error}</span>}
        {!error && saving && <span className="text-ink-muted">Saving…</span>}
        {!error && !saving && saved && <span className="text-success">Saved</span>}
      </div>
    </details>
  );
}
