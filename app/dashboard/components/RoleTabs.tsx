"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ROLES = [
  { key: "pm", label: "Product Manager" },
  { key: "spm", label: "Senior PM" },
] as const;

export default function RoleTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border bg-surface px-6">
      {ROLES.map((role) => {
        const href = `/dashboard/${role.key}`;
        const active = pathname === href;
        return (
          <Link
            key={role.key}
            href={href}
            className={`relative px-4 py-3 text-sm font-medium transition ${
              active ? "text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {role.label}
            {active && (
              <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
