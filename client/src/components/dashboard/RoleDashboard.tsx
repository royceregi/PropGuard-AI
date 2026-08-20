import { DashboardStats } from "@/components/stats/DashboardStats";
import { TransactionPreviewCard } from "@/components/ui/TransactionPreviewCard";

interface RoleDashboardProps {
  title: string;
  description: string;
}

export function RoleDashboard({ title, description }: RoleDashboardProps) {
  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6 xl:p-8">
      <header className="rounded-xl border border-border-subtle bg-surface p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-secondary">
          {description}
        </p>
      </header>
      <DashboardStats />
      <TransactionPreviewCard />
    </div>
  );
}
