"use client";

import { useAuth } from "@/hooks/useAuth";
import { RegistryRiskQueue } from "./RegistryRiskQueue";
import { RequesterRiskView } from "./RequesterRiskView";
import { RestrictedState } from "./RiskShared";

export function RiskAnalysisUI() {
  const { user } = useAuth();
  const level = user?.access_level;

  if (!level) {
    return (
      <p className="p-6 text-sm text-text-muted">Loading risk analysis…</p>
    );
  }
  if (level === "REGISTRY") {
    return <RegistryRiskQueue />;
  }
  if (level === "PUBLIC" || level === "COMPANY") {
    return <RequesterRiskView />;
  }
  return <RestrictedState />;
}
