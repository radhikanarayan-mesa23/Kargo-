export default function ModeBanner() {
  const isLive = process.env.EMAIL_MODE === "live";
  const testRecipient = process.env.TEST_RECIPIENT;

  if (isLive) {
    return (
      <div className="flex items-center gap-2 whitespace-nowrap bg-success/10 px-4 py-1.5 text-xs font-medium text-success">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
        LIVE &mdash; sends go to real candidates
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap bg-brand-tint px-4 py-1.5 text-xs font-medium text-ink">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
      <span>DRY RUN</span>
      <span className="text-ink/60">&middot;</span>
      <span>
        sends go to{" "}
        {testRecipient ? (
          <code className="rounded bg-white/70 px-1 py-px text-[11px]">{testRecipient}</code>
        ) : (
          <span className="italic">TEST_RECIPIENT not set</span>
        )}
      </span>
      <span className="text-ink/60">&middot;</span>
      <span>real recipient shown in subject</span>
    </div>
  );
}
