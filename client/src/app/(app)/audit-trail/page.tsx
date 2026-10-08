import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditTrailUI } from "@/components/audit-trail/AuditTrailUI";

export const metadata: Metadata = {
  title: "Agent Audit Trail · PropGuard AI",
  description:
    "Autonomous AI agent telemetry and execution audit trail for PropGuard AI"
};

export default function AuditTrailPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-text-muted">
          Loading agent audit trail…
        </p>
      }
    >
      <AuditTrailUI />
    </Suspense>
  );
}
