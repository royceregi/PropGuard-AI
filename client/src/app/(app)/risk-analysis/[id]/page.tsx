import type { Metadata } from "next";
import { RiskRequestRedirect } from "@/components/risk-analysis/RiskRequestRedirect";

export const metadata: Metadata = {
  title: "Risk Assessment · PropGuard AI"
};

export default async function RiskRequestPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <RiskRequestRedirect requestId={decodeURIComponent(id)} />;
}
