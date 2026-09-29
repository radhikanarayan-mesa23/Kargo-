import { beforeEach, describe, expect, it, vi } from "vitest";

// decide-and-send.ts (correctly) guards itself with "server-only" against
// accidental client-bundle inclusion; that guard throws unconditionally
// outside Next's own bundler, so it's stubbed out for this Node test run.
vi.mock("server-only", () => ({}));

const findCandidateById = vi.fn();
const updateCandidateStatus = vi.fn();
const getLatestDecision = vi.fn();
const recordDecision = vi.fn();
const findEmail = vi.fn();
const recordEmail = vi.fn();
const getLatestDraft = vi.fn();
const saveDraft = vi.fn();
const generateDraft = vi.fn();
const getScoreContext = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/db/candidates", () => ({ findCandidateById, updateCandidateStatus }));
vi.mock("@/lib/db/decisions", () => ({ getLatestDecision, recordDecision }));
vi.mock("@/lib/db/emails", () => ({ findEmail, recordEmail }));
vi.mock("@/lib/db/drafts", () => ({ getLatestDraft, saveDraft }));
vi.mock("@/lib/drafting/generate-draft", () => ({ generateDraft }));
vi.mock("@/lib/drafting/get-score-context", () => ({
  getScoreContext,
  readDraftingContext: (score: { probes?: string[]; risks?: { overall?: string[] }; hidden_value?: unknown[]; key_insight?: string }) => ({
    probes: score.probes ?? [],
    risks: score.risks?.overall ?? [],
    hiddenValue: score.hidden_value ?? [],
    keyInsight: score.key_insight ?? "",
  }),
}));
vi.mock("@/lib/email/resend-client", () => ({ sendEmail }));

const { decideAndSend } = await import("@/lib/actions/decide-and-send");

const CANDIDATE = { id: "c1", name: "Asha Verma", email: "asha@example.com" };
const DRAFT = { subject: "Hi", body_template: "Hi {{first_name}}", brief_md: "" };

beforeEach(() => {
  vi.clearAllMocks();
  findCandidateById.mockResolvedValue(CANDIDATE);
  updateCandidateStatus.mockResolvedValue(undefined);
  findEmail.mockResolvedValue(null);
  getLatestDraft.mockResolvedValue(DRAFT);
  recordDecision.mockImplementation(async (candidateId, decision) => ({
    id: "d1",
    candidate_id: candidateId,
    decision,
    note: null,
    decided_at: new Date().toISOString(),
  }));
  getLatestDecision.mockResolvedValue({
    id: "d1",
    candidate_id: "c1",
    decision: "advance",
    note: null,
    decided_at: new Date().toISOString(),
  });
  recordEmail.mockResolvedValue(undefined);
  sendEmail.mockResolvedValue({ mode: "dry", result: { ok: true, resendId: "r1" } });
});

describe("decideAndSend -- no-decision-no-send guard", () => {
  it("never calls sendEmail if the decision-row verification fails after insert", async () => {
    // Simulate a corrupted/failed verification read: the row that comes
    // back doesn't match what was just inserted.
    getLatestDecision.mockResolvedValue({
      id: "SOME_OTHER_ID",
      candidate_id: "c1",
      decision: "hold",
      note: null,
      decided_at: new Date().toISOString(),
    });

    const result = await decideAndSend({
      candidateId: "c1",
      rubricVariant: "pm",
      decision: "advance",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("internal");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("records the decision before ever calling sendEmail (ordering)", async () => {
    const callOrder: string[] = [];
    recordDecision.mockImplementation(async (candidateId, decision) => {
      callOrder.push("recordDecision");
      return { id: "d1", candidate_id: candidateId, decision, note: null, decided_at: "now" };
    });
    sendEmail.mockImplementation(async () => {
      callOrder.push("sendEmail");
      return { mode: "dry", result: { ok: true, resendId: "r1" } };
    });

    await decideAndSend({ candidateId: "c1", rubricVariant: "pm", decision: "advance" });

    expect(callOrder).toEqual(["recordDecision", "sendEmail"]);
  });

  it("a hold decision never calls sendEmail at all", async () => {
    const result = await decideAndSend({
      candidateId: "c1",
      rubricVariant: "pm",
      decision: "hold",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.emailed).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(recordDecision).toHaveBeenCalledWith("c1", "hold", undefined);
  });
});

describe("decideAndSend -- duplicate-send rejection", () => {
  it("refuses to send when an email of that type was already sent, without recording a new decision", async () => {
    findEmail.mockResolvedValue({
      id: "e1",
      candidate_id: "c1",
      type: "invite",
      mode: "dry",
      resend_id: "r0",
      status: "sent",
      error: null,
      sent_at: "earlier",
    });

    const result = await decideAndSend({
      candidateId: "c1",
      rubricVariant: "pm",
      decision: "advance",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("already_sent");
    expect(recordDecision).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("a second decideAndSend call for the same candidate+type is rejected after the first succeeds", async () => {
    const first = await decideAndSend({
      candidateId: "c1",
      rubricVariant: "pm",
      decision: "advance",
    });
    expect(first.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    // Simulate the emails row now existing, as it would after the first send.
    findEmail.mockResolvedValue({
      id: "e1",
      candidate_id: "c1",
      type: "invite",
      mode: "dry",
      resend_id: "r1",
      status: "sent",
      error: null,
      sent_at: "now",
    });

    const second = await decideAndSend({
      candidateId: "c1",
      rubricVariant: "pm",
      decision: "advance",
    });

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("already_sent");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("decideAndSend -- happy path", () => {
  it("advance sends an invite with the candidate's real name substituted in", async () => {
    const result = await decideAndSend({
      candidateId: "c1",
      rubricVariant: "pm",
      decision: "advance",
    });

    expect(result.ok).toBe(true);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "asha@example.com", html: expect.stringContaining("Asha") }),
    );
    expect(recordEmail).toHaveBeenCalledWith(
      expect.objectContaining({ candidateId: "c1", type: "invite", status: "sent" }),
    );
    expect(updateCandidateStatus).toHaveBeenCalledWith("c1", "advanced");
  });

  it("auto-generates a draft on demand when none exists yet", async () => {
    getLatestDraft.mockResolvedValue(null);
    getScoreContext.mockResolvedValue({
      candidate: { ...CANDIDATE, cv_text_redacted: "redacted text" },
      score: { probes: [], risks: {}, hidden_value: [], key_insight: "" },
      rubricVariant: "pm",
    });
    generateDraft.mockResolvedValue({
      briefMd: "brief",
      subject: "Generated subject",
      bodyTemplate: "Hi {{first_name}}",
    });
    saveDraft.mockResolvedValue({ ...DRAFT, subject: "Generated subject" });

    const result = await decideAndSend({
      candidateId: "c1",
      rubricVariant: "pm",
      decision: "decline",
    });

    expect(result.ok).toBe(true);
    expect(generateDraft).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Generated subject" }),
    );
  });
});
