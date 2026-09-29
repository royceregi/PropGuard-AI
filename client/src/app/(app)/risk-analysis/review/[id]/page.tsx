import type { Metadata } from "next";
import { RegistryReviewWorkspace } from "@/components/risk-analysis/RegistryReviewWorkspace";

export const metadata: Metadata = {
  title: "Review Risk Assessment · PropGuard AI"
};

export default async function RiskReviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8">
      <RegistryReviewWorkspace requestId={decodeURIComponent(id)} />
    </div>
  );
}
