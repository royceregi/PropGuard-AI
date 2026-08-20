import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export default function PublicDashboardPage() {
  return (
    <RoleDashboard
      title="My properties"
      description="Personal title passbook for properties you own. Verification status and transaction history are limited to your own records."
    />
  );
}
