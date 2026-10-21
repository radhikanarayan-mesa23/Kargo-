import { rate, type OutcomeStats } from "@/lib/dashboard/compute-outcomes";
import type { Band } from "@/lib/processing/types";

const BAND_LABELS: Record<Band, string> = {
  PRIORITY_SHORTLIST: "Priority shortlist",
  SHORTLIST: "Shortlist",
  HOLD: "Hold",
  DECLINE_QUEUE: "Decline queue",
};

function Pct({ n, d }: { n: number; d: number }) {
  const r = rate(n, d);
  return (
    <span className="tabular-nums">
      {n}
      <span className="text-ink-muted">
        /{d}
        {r !== null && ` · ${r}%`}
      </span>
    </span>
  );
}

/**
 * Whether the bands mean anything. If priority shortlist and shortlist
 * convert at the same rate, the 80-point threshold between them is noise,
 * and that is worth seeing rather than assuming.
 */
export default function OutcomePanel({ stats }: { stats: OutcomeStats }) {
  const anyRecorded = stats.totalInvited - stats.awaitingOutcome > 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Did the shortlist work?</h3>
        <span className="text-xs text-ink-muted">
          {stats.awaitingOutcome} of {stats.totalInvited} invited still have no outcome recorded
        </span>
      </div>

      {!anyRecorded ? (
        <p className="mt-3 text-sm text-ink-muted">
          Nothing recorded yet. Open the Interviews tab and fill in{" "}
          <span className="font-medium text-ink">What happened</span> on a candidate &mdash;
          until then this dashboard can only tell you how many résumés it processed, not
          whether any of it was useful.
        </p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="pb-2 pr-4 font-semibold">Band</th>
                  <th className="pb-2 pr-4 font-semibold">Interviewed</th>
                  <th className="pb-2 pr-4 font-semibold">Strong</th>
                  <th className="pb-2 pr-4 font-semibold">Offers</th>
                  <th className="pb-2 pr-4 font-semibold">Started</th>
                  <th className="pb-2 font-semibold">Working out</th>
                </tr>
              </thead>
              <tbody className="text-ink">
                {stats.byBand.map((b) => (
                  <tr key={b.band} className="border-t border-border">
                    <td className="py-2 pr-4 font-medium">{BAND_LABELS[b.band]}</td>
                    <td className="py-2 pr-4">
                      <Pct n={b.interviewed} d={b.invited} />
                    </td>
                    <td className="py-2 pr-4">
                      <Pct n={b.strong} d={b.interviewed} />
                    </td>
                    <td className="py-2 pr-4">
                      <Pct n={b.offersMade} d={b.invited} />
                    </td>
                    <td className="py-2 pr-4 tabular-nums">{b.started}</td>
                    <td className="py-2">
                      <Pct n={b.workingOut} d={b.checked90d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Rates are over what has actually been recorded, never over the whole pipeline.
            A band needs a real number of outcomes before its percentage means anything.
          </p>
        </>
      )}

      <div className="mt-4 border-t border-border pt-3 text-sm">
        <span className="text-ink-muted">Declines later overturned: </span>
        <span className="font-medium tabular-nums text-ink">{stats.reversedDeclines}</span>
        <p className="mt-1 text-xs text-ink-muted">
          The only false-negative signal the system can produce on its own. Zero may mean the
          screening is sound &mdash; or that nobody has gone back to look.
        </p>
      </div>
    </div>
  );
}
