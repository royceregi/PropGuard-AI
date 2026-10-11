import type { Metadata } from "next";
import { Suspense } from "react";
import { PropertySearchUI } from "@/components/property-search/PropertySearchUI";

export const metadata: Metadata = {
  title: "Property Search · PropGuard AI"
};

export default function PropertySearchPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-text-muted">Loading property search…</p>
      }
    >
      <PropertySearchUI />
    </Suspense>
  );
}
