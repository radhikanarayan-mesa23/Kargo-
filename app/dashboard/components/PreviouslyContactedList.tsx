import { getPreviouslyContacted } from "@/lib/dashboard/previously-contacted";

export default function PreviouslyContactedList() {
  const people = getPreviouslyContacted();
  if (people.length === 0) return null;

  return (
    <div className="border-b border-border bg-brand-tint/40 px-6 py-2">
      <p className="text-xs font-medium text-ink">
        Previously contacted &mdash;{" "}
        <span className="font-normal text-ink-muted">
          {people.map((p, i) => (
            <span key={p.email}>
              {i > 0 && ", "}
              {p.name}
              {p.note && <span className="italic"> ({p.note})</span>}
            </span>
          ))}
        </span>
      </p>
    </div>
  );
}
