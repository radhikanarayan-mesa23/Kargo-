"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/pm", label: "Product Manager", exact: false },
  { href: "/dashboard/spm", label: "Senior PM", exact: false },
  { href: "/dashboard/interviews", label: "Interviews", exact: false },
] as const;

export default function DashboardTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-6">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative whitespace-nowrap px-4 py-3 text-sm font-medium transition ${
              active ? "text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {active && (
              <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
