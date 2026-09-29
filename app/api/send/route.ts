import { NextRequest, NextResponse } from "next/server";
import { decideAndSend } from "@/lib/actions/decide-and-send";
import type { DecisionType } from "@/lib/db/decisions";
import type { Role } from "@/lib/processing/types";

const VALID_DECISIONS = new Set<DecisionType>(["advance", "hold", "decline"]);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const candidateId = body?.candidateId;
  const decision = body?.decision as DecisionType | undefined;
  const rubricVariant = body?.rubricVariant as Role | undefined;

  if (typeof candidateId !== "string" || !decision || !VALID_DECISIONS.has(decision)) {
    return NextResponse.json(
      { error: "candidateId and decision ('advance' | 'hold' | 'decline') are required" },
      { status: 400 },
    );
  }

  const result = await decideAndSend({
    candidateId,
    rubricVariant: rubricVariant ?? "pm",
    decision,
    note: typeof body?.note === "string" ? body.note : undefined,
    editedSubject: typeof body?.editedSubject === "string" ? body.editedSubject : undefined,
    editedBody: typeof body?.editedBody === "string" ? body.editedBody : undefined,
  });

  if (!result.ok) {
    const status = result.code === "not_found" ? 404 : result.code === "already_sent" ? 409 : 422;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
