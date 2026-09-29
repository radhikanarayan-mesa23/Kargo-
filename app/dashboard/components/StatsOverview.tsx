import type { RoleStats } from "@/lib/dashboard/compute-stats";

function GradientTile({
  label,
  value,
  gradient,
}: {
  label: string;
  value: number;
  gradient: string;
}) {
  return (
    <div className={`rounded-lg bg-gradient-to-br ${gradient} p-5 text-white shadow-sm`}>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-white/85">{label}</div>
    </div>
  );
}

function PlainTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="text-3xl font-semibold tabular-nums text-ink">{value}</div>
      <div className="mt-1 text-sm text-ink-muted">{label}</div>
    </div>
  );
}

export default function StatsOverview({ stats }: { stats: RoleStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <GradientTile
        label="Total resumes"
        value={stats.totalResumes}
        gradient="from-brand to-brand-hover"
      />
      <GradientTile
        label="Sent to interview"
        value={stats.sentToInterview}
        gradient="from-success to-emerald-700"
      />
      <GradientTile label="Rejected" value={stats.rejected} gradient="from-danger to-rose-800" />
      <PlainTile label="Pending review" value={stats.pendingReview} />
      {(stats.priorityShortlist > 0 ||
        stats.shortlist > 0 ||
        stats.onHold > 0 ||
        stats.declineQueue > 0) && (
        <div className="col-span-2 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface px-5 py-3 text-sm text-ink-muted sm:col-span-4">
          <span className="font-medium text-ink">By band:</span>
          <span>
            <span className="font-medium text-ink">{stats.priorityShortlist}</span> priority
            shortlist
          </span>
          <span>
            <span className="font-medium text-ink">{stats.shortlist}</span> shortlist
          </span>
          <span>
            <span className="font-medium text-ink">{stats.onHold}</span> hold
          </span>
          <span>
            <span className="font-medium text-ink">{stats.declineQueue}</span> decline queue
          </span>
        </div>
      )}
    </div>
  );
}
