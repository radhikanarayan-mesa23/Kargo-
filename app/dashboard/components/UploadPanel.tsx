"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/processing/types";

type FileStatus = "queued" | "uploading" | "scoring" | "drafting" | "done" | "error";

interface FileState {
  file: File;
  status: FileStatus;
  error?: string;
  candidateName?: string;
}

const STATUS_LABELS: Record<FileStatus, string> = {
  queued: "Queued",
  uploading: "Uploading & redacting…",
  scoring: "Scoring against the rubric…",
  drafting: "Drafting brief & email…",
  done: "Done",
  error: "Failed",
};

export default function UploadPanel({ role }: { role: Role }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileState[]>([]);
  const [processing, setProcessing] = useState(false);

  function onFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next = Array.from(fileList).map((file) => ({ file, status: "queued" as FileStatus }));
    setFiles(next);
    void processFiles(next);
  }

  async function processFiles(items: FileState[]) {
    setProcessing(true);
    const working = [...items];

    for (let i = 0; i < working.length; i++) {
      const update = (patch: Partial<FileState>) => {
        working[i] = { ...working[i], ...patch };
        setFiles([...working]);
      };

      try {
        update({ status: "uploading" });
        const formData = new FormData();
        formData.append("file", working[i].file);
        formData.append("role", role);

        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          update({ status: "error", error: uploadData.error ?? "Upload failed" });
          continue;
        }
        update({ candidateName: uploadData.candidate?.name ?? undefined });

        update({ status: "scoring" });
        const scoreRes = await fetch("/api/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: uploadData.candidate.id }),
        });
        const scoreData = await scoreRes.json();
        if (!scoreRes.ok) {
          update({ status: "error", error: scoreData.error ?? "Scoring failed" });
          continue;
        }

        update({ status: "drafting" });
        const draftRes = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId: uploadData.candidate.id }),
        });
        const draftData = await draftRes.json();
        if (!draftRes.ok) {
          // A drafting failure shouldn't hide a successful score -- surface it
          // but still mark the candidate as scored; the card can regenerate
          // the draft later.
          update({ status: "error", error: `Scored, but drafting failed: ${draftData.error}` });
          continue;
        }

        update({ status: "done" });
      } catch (err) {
        update({ status: "error", error: (err as Error).message });
      }
    }

    setProcessing(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Upload CVs</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            .pdf or .docx, one or many &mdash; applying for{" "}
            <span className="font-medium uppercase">{role}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-hover disabled:opacity-50"
        >
          {processing ? "Processing…" : "Choose files"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          multiple
          className="hidden"
          onChange={(e) => onFilesSelected(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-ink">{f.candidateName ?? f.file.name}</span>
              <span
                className={
                  f.status === "error"
                    ? "shrink-0 text-danger"
                    : f.status === "done"
                      ? "shrink-0 text-success"
                      : "shrink-0 text-ink-muted"
                }
              >
                {f.error ?? STATUS_LABELS[f.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
