import type { Metadata } from "next";
import { HeroSection } from "@/components/landing/HeroSection";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { ProcessTimeline } from "@/components/landing/ProcessTimeline";
import { SolutionsGrid } from "@/components/landing/SolutionsGrid";
import { TrustBanner } from "@/components/landing/TrustBanner";

export const metadata: Metadata = {
  title: "PropGuard AI · Property Transaction Verification",
  description:
    "Enterprise-grade AI and blockchain verification for land transactions. Tamper-evident integrity checks and explainable fraud-risk decision support for registries, enterprises, and property owners.",
};

export default function LandingPage() {
  return (
    <div className="min-h-full flex-1 overflow-y-auto bg-surface-canvas">
      <LandingNavbar />
      <main>
        <HeroSection />
        <SolutionsGrid />
        <ProcessTimeline />
        <TrustBanner />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
