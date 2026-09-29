"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/lib/processing/types";

export default function BatchDeclineButton({
  role,
  queuedCount,
}: {
  role: Role;
  queuedCount: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (queuedCount === 0) return null;

  async function handleClick() {
    if (
      !confirm(
        `Send ${queuedCount} decline email${queuedCount === 1 ? "" : "s"} for the queued candidates in this role? This cannot be undone.`,
      )
    ) {
      return;
    }
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/batch-decline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error ?? "Batch decline failed");
        return;
      }
      setResult(`Sent ${data.sent}/${data.total}${data.failed ? `, ${data.failed} failed` : ""}`);
      router.refresh();
    } catch (err) {
      setResult((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-danger/30 bg-surface px-5 py-3">
      <p className="flex-1 text-sm text-ink">
        <span className="font-medium">{queuedCount}</span> candidate
        {queuedCount === 1 ? "" : "s"} queued for decline with no decision yet.
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="rounded-md border border-danger/30 bg-surface px-3.5 py-2 text-sm font-medium text-danger transition hover:bg-danger-tint disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send all queued declines"}
      </button>
      {result && <span className="text-xs text-ink-muted">{result}</span>}
    </div>
  );
}
