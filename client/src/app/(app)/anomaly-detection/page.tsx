import type { Metadata } from "next";
import { AnomalyDetectionUI } from "@/components/anomaly/AnomalyDetectionUI";

export const metadata: Metadata = {
  title: "Anomaly Detection · PropGuard AI"
};

export default function AnomalyDetectionPage() {
  return <AnomalyDetectionUI />;
}
