import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/HeroSection";

export const metadata: Metadata = {
  title: "PropGuard AI · Property Transaction Verification",
  description:
    "Enterprise-grade AI and blockchain verification for land transactions. Tamper-evident integrity checks and explainable fraud-risk decision support for registries, enterprises, and property owners."
};

export default function LandingPage() {
  return (
    <div className="min-h-full flex-1 overflow-y-auto bg-surface-canvas">
      <main>
        <HeroSection />
      </main>
    </div>
  );
}
