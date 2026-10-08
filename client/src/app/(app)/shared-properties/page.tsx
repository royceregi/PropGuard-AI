import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedPropertiesUI } from "@/components/shares/SharedPropertiesUI";

export const metadata: Metadata = {
  title: "Shared Properties · PropGuard AI",
  description: "View and manage properties shared for buyer due diligence"
};

export default function SharedPropertiesPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-text-muted">
          Loading shared properties…
        </p>
      }
    >
      <SharedPropertiesUI />
    </Suspense>
  );
}
