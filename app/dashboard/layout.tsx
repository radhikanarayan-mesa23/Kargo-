import ModeBanner from "@/app/dashboard/components/ModeBanner";
import DashboardTabs from "@/app/dashboard/components/DashboardTabs";
import PreviouslyContactedList from "@/app/dashboard/components/PreviouslyContactedList";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-canvas">
      <ModeBanner />
      <header className="border-b border-border bg-surface px-6 py-4">
        <h1 className="text-lg font-semibold text-ink">
          Kargo <span className="font-display italic text-brand">Hiring</span>
        </h1>
      </header>
      <PreviouslyContactedList />
      <DashboardTabs />
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
