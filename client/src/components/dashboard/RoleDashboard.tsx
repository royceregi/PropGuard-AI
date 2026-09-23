import { DashboardStats } from "@/components/stats/DashboardStats";
import { TransactionPreviewCard } from "@/components/ui/TransactionPreviewCard";

export function RoleDashboard() {
  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6 xl:p-8">
      <DashboardStats />
      <TransactionPreviewCard />
    </div>
  );
}
