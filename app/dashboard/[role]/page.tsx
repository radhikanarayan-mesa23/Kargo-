import { notFound } from "next/navigation";
import UploadPanel from "@/app/dashboard/components/UploadPanel";
import CandidateCard from "@/app/dashboard/components/CandidateCard";
import StatsOverview from "@/app/dashboard/components/StatsOverview";
import BatchDeclineButton from "@/app/dashboard/components/BatchDeclineButton";
import { getRoleView } from "@/lib/dashboard/get-role-view";
import { computeStats } from "@/lib/dashboard/compute-stats";
import type { Role } from "@/lib/processing/types";

function isRole(value: string): value is Role {
  return value === "pm" || value === "spm";
}

export default async function DashboardRolePage({
  params,
}: {
  params: Promise<{ role: string }>;
}) {
  const { role: roleParam } = await params;
  if (!isRole(roleParam)) notFound();

  const { candidates, hiddenHoldCount } = await getRoleView(roleParam);
  const stats = computeStats(candidates, hiddenHoldCount);

  return (
    <div className="flex flex-col gap-4">
      <StatsOverview stats={stats} />
      <UploadPanel role={roleParam} />
      <BatchDeclineButton role={roleParam} queuedCount={stats.queuedDeclines} />

      {hiddenHoldCount > 0 && (
        <p className="text-xs text-ink-muted">
          {hiddenHoldCount} candidate{hiddenHoldCount === 1 ? "" : "s"} on Hold hidden &mdash;
          shown automatically once this role has fewer than 5 shortlisted candidates.
        </p>
      )}

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
          No candidates scored for this role yet. Upload a CV above to get started.
        </div>
      ) : (
        candidates.map((c) => (
          <CandidateCard
            key={c.candidateId}
            candidateId={c.candidateId}
            rubricVariant={roleParam}
            name={c.name}
            band={c.band}
            total={c.total}
            reason={c.reason}
            keyInsight={c.keyInsight}
            criteria={c.criteria}
            hiddenValue={c.hiddenValue}
            locationFlag={c.locationFlag}
            crossScore={c.crossScore}
            decision={c.decision ? { decision: c.decision.decision } : null}
            emails={{
              invite: c.emails.invite ? { status: c.emails.invite.status } : undefined,
              decline: c.emails.decline ? { status: c.emails.decline.status } : undefined,
            }}
            recommendedDraftType={c.recommendedDraftType}
            draft={
              c.draft
                ? {
                    subject: c.draft.subject,
                    bodyTemplate: c.draft.body_template,
                    briefMd: c.draft.brief_md,
                  }
                : null
            }
          />
        ))
      )}
    </div>
  );
}
