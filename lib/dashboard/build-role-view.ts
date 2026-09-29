import type { Band, Confidence, Criteria, Role } from "@/lib/processing/types";
import { buildWhyRankedHere, compareCandidatesForRanking, isHoldVisible } from "@/lib/processing";
import type { PersistedGates } from "@/lib/db/scores";
import type { DecisionRow } from "@/lib/db/decisions";
import type { EmailRow, EmailType } from "@/lib/db/emails";
import type { DraftRow } from "@/lib/db/drafts";
import { recommendedDraftType } from "@/lib/drafting/recommended-type";

const CRITERION_UI_LABELS: Record<keyof Criteria, string> = {
  c1: "C1 · Lived the job",
  c2: "C2 · Live-fire ownership",
  c3: "C3 · Unprompted build",
  c4: "C4 · Role capability",
  c5: "C5 · Low-structure record",
};

export interface RawScoreRow {
  candidate_id: string;
  rubric_variant: Role;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  confidence: Record<keyof Criteria, Confidence>;
  quotes: Record<keyof Criteria, string[]>;
  gates: PersistedGates;
  total: number;
  band: Band;
  hidden_value: { item: string; quote: string }[];
  key_insight: string;
  candidates: {
    id: string;
    name: string | null;
    email: string;
    status: string;
    created_at: string;
  } | null;
}

export interface CriterionView {
  key: keyof Criteria;
  label: string;
  score: 0 | 1 | 2 | 3 | 4;
  confidence: Confidence;
  quotes: string[];
}

export interface RoleViewCandidate {
  candidateId: string;
  name: string;
  email: string;
  status: string;
  band: Band;
  total: number;
  keyInsight: string;
  criteria: CriterionView[];
  hiddenValue: { item: string; quote: string }[];
  locationFlag?: string;
  gateReason?: string;
  crossScore?: { role: Role; total: number; band: Band };
  reason: string;
  decision: DecisionRow | null;
  emails: Partial<Record<EmailType, EmailRow>>;
  recommendedDraftType: EmailType;
  draft: DraftRow | null;
}

export interface BuildRoleViewResult {
  candidates: RoleViewCandidate[];
  hiddenHoldCount: number;
}

const CRITERION_KEYS: (keyof Criteria)[] = ["c1", "c2", "c3", "c4", "c5"];

function toCriteria(row: RawScoreRow): CriterionView[] {
  return CRITERION_KEYS.map((key) => ({
    key,
    label: CRITERION_UI_LABELS[key],
    score: row[key] as 0 | 1 | 2 | 3 | 4,
    confidence: row.confidence?.[key] ?? "L",
    quotes: row.quotes?.[key] ?? [],
  }));
}

/** Reconstructs the Criteria shape buildWhyRankedHere expects from a raw row. */
function toCriteriaRecord(row: RawScoreRow): Criteria {
  const record = {} as Criteria;
  for (const key of CRITERION_KEYS) {
    record[key] = {
      score: row[key] as 0 | 1 | 2 | 3 | 4,
      confidence: row.confidence?.[key] ?? "L",
      quotes: row.quotes?.[key] ?? [],
      risks: [],
    };
  }
  return record;
}

export function buildRoleView(
  role: Role,
  rows: RawScoreRow[],
  otherVariantScores: Map<string, RawScoreRow>,
  decisions: Map<string, DecisionRow>,
  emails: Map<string, Partial<Record<EmailType, EmailRow>>>,
  drafts: Map<string, Partial<Record<EmailType, DraftRow>>>,
): BuildRoleViewResult {
  const items = rows
    .filter((row) => row.candidates)
    .map((row) => {
      const candidate = row.candidates!;
      const cross = otherVariantScores.get(candidate.id);
      const wantedType = recommendedDraftType(row.band);

      const view: RoleViewCandidate = {
        candidateId: candidate.id,
        name: candidate.name ?? "(name not found on CV)",
        email: candidate.email,
        status: candidate.status,
        band: row.band,
        total: Number(row.total),
        keyInsight: row.key_insight,
        criteria: toCriteria(row),
        hiddenValue: row.hidden_value ?? [],
        locationFlag: row.gates?.g2?.flag,
        gateReason: !row.gates?.g1?.passed ? row.gates?.g1?.reason : undefined,
        reason: !row.gates?.g1?.passed
          ? (row.gates?.g1?.reason ?? "")
          : buildWhyRankedHere(toCriteriaRecord(row), Number(row.total), row.band),
        recommendedDraftType: wantedType,
        draft: drafts.get(candidate.id)?.[wantedType] ?? null,
        crossScore: cross
          ? { role: cross.rubric_variant, total: Number(cross.total), band: cross.band }
          : undefined,
        decision: decisions.get(candidate.id) ?? null,
        emails: emails.get(candidate.id) ?? {},
      };
      return { view, row };
    });

  const shortlistCount = items.filter(
    (i) => i.view.band === "PRIORITY_SHORTLIST" || i.view.band === "SHORTLIST",
  ).length;
  const holdVisible = isHoldVisible(shortlistCount);

  const visible = items.filter((i) => i.view.band !== "HOLD" || holdVisible);
  const hiddenHoldCount = items.length - visible.length;

  visible.sort((a, b) =>
    compareCandidatesForRanking(
      {
        candidateId: a.view.candidateId,
        band: a.view.band,
        total: a.view.total,
        c1: a.row.c1,
        c2: a.row.c2,
        hiddenValueCount: a.view.hiddenValue.length,
        // Approximation: total hands-on-ops years stands in for "more recent"
        // exposure -- the AI schema doesn't separately capture recency, and
        // this is the lowest-weighted tie-breaker (Section 8, 4th in order).
        recentHandsOnOpsMonths: (a.row.gates?.experience?.yearsHandsOnOps ?? 0) * 12,
      },
      {
        candidateId: b.view.candidateId,
        band: b.view.band,
        total: b.view.total,
        c1: b.row.c1,
        c2: b.row.c2,
        hiddenValueCount: b.view.hiddenValue.length,
        recentHandsOnOpsMonths: (b.row.gates?.experience?.yearsHandsOnOps ?? 0) * 12,
      },
    ),
  );

  return { candidates: visible.map((i) => i.view), hiddenHoldCount };
}
