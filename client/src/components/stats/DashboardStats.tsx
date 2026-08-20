"use client";

import { Icons } from "@/components/icons";
import { StatsCard } from "@/components/stats/StatsCard";

export function DashboardStats() {
  return (
    <section
      aria-label="Dashboard statistics"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5"
    >
      <StatsCard
        title="Properties Analyzed"
        value="12,450"
        icon={Icons.AccountBalance}
        trend={{ value: "+4.2%", label: "vs last month", positive: true }}
      />
      <StatsCard
        title="Transactions Verified"
        value="8,920"
        icon={Icons.Description}
        trend={{ value: "+12.1%", label: "30d volume", positive: true }}
      />
      <StatsCard
        title="Blockchain Success"
        value="99.8%"
        icon={Icons.ViewInAr}
        variant="highlight"
        progress={99.8}
        tag="IMMUTABLE"
      />
      <StatsCard
        title="High-Risk Tx"
        value="12"
        icon={Icons.GppMaybe}
        variant="error"
        trend={{ value: "Warning", label: "Action Required", isError: true }}
      />
      <StatsCard
        title="Active Cases"
        value="05"
        icon={Icons.AutoAwesome}
        variant="info"
        trend={{ value: "", label: "AI Analysis Pending" }}
      />
    </section>
  );
}
