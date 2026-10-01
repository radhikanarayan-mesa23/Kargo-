import InterviewCard from "@/app/dashboard/components/InterviewCard";
import { getInterviewCandidates } from "@/lib/dashboard/get-interviews";

// Always render per-request: this page reads live pipeline counts from
// Supabase, and without this Next prerenders it at build time and serves
// frozen numbers forever.
export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const candidates = await getInterviewCandidates();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Interviews</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {candidates.length === 0
            ? "Candidates appear here once their interview invite has actually been sent."
            : `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} invited to interview.`}
        </p>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-ink-muted">
          No one has been sent an interview invite yet. Advance a candidate from a role tab
          and they&apos;ll show up here with notes.
        </div>
      ) : (
        candidates.map((c) => (
          <InterviewCard
            key={c.candidateId}
            candidateId={c.candidateId}
            name={c.name}
            email={c.email}
            role={c.role}
            total={c.total}
            band={c.band}
            keyInsight={c.keyInsight}
            probes={c.probes}
            risks={c.risks}
            hiddenValue={c.hiddenValue}
            resumeSummary={c.resumeSummary}
            invitedAt={c.invitedAt}
          />
        ))
      )}
    </div>
  );
}
