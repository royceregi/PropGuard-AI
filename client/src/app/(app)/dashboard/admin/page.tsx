import { RoleDashboard } from "@/components/dashboard/RoleDashboard";
import { BlockchainHashManagement } from "@/components/settings/BlockchainHashManagement";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <RoleDashboard />
      <div className="px-3 pb-3 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6 xl:px-8 xl:pb-8">
        <BlockchainHashManagement />
      </div>
    </div>
  );
}
