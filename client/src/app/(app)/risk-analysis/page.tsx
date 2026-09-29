import { Suspense } from "react";
import { RiskAnalysisUI } from "@/components/risk-analysis/RiskAnalysisUI";

export default function RiskAnalysisPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-text-muted">Loading risk analysis…</p>
      }
    >
      <RiskAnalysisUI />
    </Suspense>
  );
}
