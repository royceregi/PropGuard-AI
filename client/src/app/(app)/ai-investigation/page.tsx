import type { Metadata } from "next";
import { Suspense } from "react";
import { AIInvestigationUI } from "@/components/ai-investigation/AIInvestigationUI";

export const metadata: Metadata = {
  title: "AI Investigation Console · PropGuard AI"
};

export default function AIInvestigationPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-text-muted">
          Loading AI investigation console…
        </p>
      }
    >
      <AIInvestigationUI />
    </Suspense>
  );
}
