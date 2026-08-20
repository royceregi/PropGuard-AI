import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function AdminDashboardPage() {
  return (
    <RoleDashboard
      title="Super Admin workspace"
      description="System-wide investigation view for dataset, user, and integrity operations. Risk indicators remain decision support for human review."
    />
  );
}
