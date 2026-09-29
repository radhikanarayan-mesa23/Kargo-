import { notFound } from "next/navigation";
import UploadPanel from "@/app/dashboard/components/UploadPanel";
import CandidateCard from "@/app/dashboard/components/CandidateCard";
import { getRoleView } from "@/lib/dashboard/get-role-view";
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

  return (
    <div className="flex flex-col gap-4">
      <UploadPanel role={roleParam} />

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
