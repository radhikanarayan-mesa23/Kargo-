import Link from "next/link";
import { getOverview } from "@/lib/dashboard/get-overview";
import type { RoleBreakdown } from "@/lib/dashboard/compute-overview";

// Always render per-request: this page reads live pipeline counts from
// Supabase, and without this Next prerenders it at build time and serves
// frozen numbers forever.
export const dynamic = "force-dynamic";

function GradientTile({
  label,
  value,
  gradient,
  sub,
}: {
  label: string;
  value: number;
  gradient: string;
  sub?: string;
}) {
  return (
    <div className={`rounded-lg bg-gradient-to-br ${gradient} p-5 text-white shadow-sm`}>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-white/85">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-white/70">{sub}</div>}
    </div>
  );
}

function PlainTile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="text-3xl font-semibold tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-sm text-ink-muted">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

function RoleCard({
  title, href, b,
}: {
  title: string;
  href: string;
  b: RoleBreakdown;
}) {
  const rows: [string, number][] = [
    ["Resumes uploaded", b.uploaded],
    ["Scored", b.scored],
    ["Awaiting your decision", b.awaitingDecision],
    ["Sent to interview", b.sentToInterview],
    ["Rejected", b.rejected],
    ["On hold", b.onHold],
  ];

  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-surface p-5 shadow-sm transition hover:border-brand/40"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="text-xs font-medium text-brand group-hover:text-brand-hover">
          Open &rarr;
        </span>
      </div>
      <dl className="mt-3 flex flex-col gap-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 text-sm">
            <dt className="text-ink-muted">{label}</dt>
            <dd className="font-medium tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

export default async function OverviewPage() {
  const stats = await getOverview();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-ink">
          Hi <span className="font-display italic text-brand">Arjun</span>
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {stats.awaitingDecision > 0 ? (
            <>
              <span className="font-medium text-ink">{stats.awaitingDecision}</span> candidate
              {stats.awaitingDecision === 1 ? "" : "s"} scored and waiting on your decision.
            </>
          ) : stats.totalUploaded === 0 ? (
            <>No resumes uploaded yet &mdash; start on a role tab above.</>
          ) : (
            <>Nothing waiting on you right now.</>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GradientTile
          label="Resumes uploaded"
          value={stats.totalUploaded}
          gradient="from-brand to-brand-hover"
          sub={`${stats.totalScored} scored`}
        />
        <PlainTile
          label="Awaiting your decision"
          value={stats.awaitingDecision}
          sub={stats.onHold > 0 ? `${stats.onHold} on hold` : undefined}
        />
        <GradientTile
          label="Sent to interview"
          value={stats.sentToInterview}
          gradient="from-success to-emerald-700"
        />
        <GradientTile
          label="Rejected"
          value={stats.rejected}
          gradient="from-danger to-rose-800"
        />
      </div>

      <div className="rounded-lg border border-border bg-surface px-5 py-3 text-sm text-ink-muted">
        <span className="font-medium text-ink">{stats.totalEmailsSent}</span> email
        {stats.totalEmailsSent === 1 ? "" : "s"} sent in total &mdash;{" "}
        {stats.sentToInterview} invite{stats.sentToInterview === 1 ? "" : "s"},{" "}
        {stats.rejected} decline{stats.rejected === 1 ? "" : "s"}.
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">By role</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RoleCard title="Product Manager" href="/dashboard/pm" b={stats.byRole.pm} />
          <RoleCard title="Senior Product Manager" href="/dashboard/spm" b={stats.byRole.spm} />
        </div>
      </div>
    </div>
  );
}
