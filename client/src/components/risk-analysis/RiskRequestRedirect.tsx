"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { riskRequestHref } from "@/lib/risk-assessment/types";

/** Resolves /risk-analysis/{id} (used by notification links) to the page for the viewer's role. */
export function RiskRequestRedirect({ requestId }: { requestId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const level = user?.access_level;

  useEffect(() => {
    if (level) {
      router.replace(riskRequestHref(requestId, level));
    }
  }, [level, requestId, router]);

  return (
    <p className="p-6 text-sm text-text-muted">Opening risk assessment…</p>
  );
}
