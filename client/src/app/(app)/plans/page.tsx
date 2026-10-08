import type { Metadata } from "next";
import { CommercialPlansUI } from "@/components/commercial-plans/CommercialPlansUI";

export const metadata: Metadata = {
  title: "Commercial Plans · PropGuard AI",
  description:
    "Select a commercial subscription plan to activate your PropGuard account."
};

export default function PlansPage() {
  return <CommercialPlansUI />;
}
