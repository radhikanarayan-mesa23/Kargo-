export default function ModeBanner() {
  const isLive = process.env.EMAIL_MODE === "live";
  const testRecipient = process.env.TEST_RECIPIENT;

  if (isLive) {
    return (
      <div className="flex items-center justify-center gap-2 bg-success/10 px-4 py-2 text-sm font-medium text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        LIVE &mdash; emails send to real candidates
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-brand-tint px-4 py-2 text-center text-sm font-medium text-ink">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
      DRY RUN &mdash; every send goes to{" "}
      {testRecipient ? (
        <code className="rounded bg-white/60 px-1 py-0.5 text-xs">{testRecipient}</code>
      ) : (
        <span className="italic">TEST_RECIPIENT (not set)</span>
      )}
      , with the real recipient shown in the subject line
    </div>
  );
}
