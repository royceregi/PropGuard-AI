import { Suspense } from "react";
import { InvestigationReportsUI } from "@/components/investigation-reports/InvestigationReportsUI";

export default function InvestigationReportsPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-text-muted">
          Loading investigation reports…
        </p>
      }
    >
      <InvestigationReportsUI />
    </Suspense>
  );
}
