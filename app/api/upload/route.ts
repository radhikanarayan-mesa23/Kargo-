import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/extraction/pdf";
import { extractDocxText } from "@/lib/extraction/docx";
import { extractContact } from "@/lib/extraction/contact";
import { redactCvText } from "@/lib/redaction/redact";
import {
  findCandidateByEmail,
  upsertCandidate,
  type RoleApplied,
} from "@/lib/db/candidates";

// PDF text extraction (pdfjs) is slow to cold-start on serverless, and this
// runs synchronously in the request before the response is sent -- without
// an explicit duration, Vercel's platform default can cut the function off
// mid-extraction, returning an empty body the client then fails to parse.
export const maxDuration = 60;

const ALLOWED_ROLES = new Set<RoleApplied>(["pm", "spm"]);

function extensionFor(file: File): "pdf" | "docx" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return null;
}

/**
 * One CV per request. Does everything except AI: store the original file
 * privately, extract text, pull out contact details, redact PII, and
 * upsert-by-email. No LLM call happens here.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  const role = formData.get("role");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (typeof role !== "string" || !ALLOWED_ROLES.has(role as RoleApplied)) {
    return NextResponse.json(
      { error: "role must be 'pm' or 'spm'" },
      { status: 400 },
    );
  }

  const ext = extensionFor(file);
  if (!ext) {
    return NextResponse.json(
      { error: "Only .pdf and .docx are supported" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  try {
    rawText =
      ext === "pdf" ? await extractPdfText(buffer) : await extractDocxText(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not extract text: ${(err as Error).message}` },
      { status: 422 },
    );
  }

  const contact = extractContact(rawText);
  if (!contact.email) {
    return NextResponse.json(
      { error: "Could not find an email address in this CV" },
      { status: 422 },
    );
  }

  const supabase = getSupabaseAdmin();
  const existing = await findCandidateByEmail(contact.email);

  const storagePath = `${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("cvs")
    .upload(storagePath, buffer, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const cvTextRedacted = redactCvText(rawText, contact);

  let result: Awaited<ReturnType<typeof upsertCandidate>>;
  try {
    result = await upsertCandidate({
      roleApplied: role as RoleApplied,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      cvPath: storagePath,
      cvTextRedacted,
    });
  } catch (err) {
    // Roll back the just-uploaded file if we couldn't record the candidate.
    await supabase.storage.from("cvs").remove([storagePath]);
    return NextResponse.json(
      { error: `Could not save candidate: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // Re-upload: the DB row now points at the new file, so drop the orphaned one.
  if (existing?.cv_path && existing.cv_path !== storagePath) {
    await supabase.storage.from("cvs").remove([existing.cv_path]);
  }

  const { candidate, wasExisting } = result;

  return NextResponse.json({
    candidate: {
      id: candidate.id,
      name: candidate.name,
      email: candidate.email,
      roleApplied: candidate.role_applied,
      status: candidate.status,
    },
    wasExisting,
    redactedPreview: cvTextRedacted,
  });
}
