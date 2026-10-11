import type { Metadata } from "next";
import { HeroSection, LandingFooter } from "@/components/landing/HeroSection";
import { LandingSections } from "@/components/landing/LandingSections";

export const metadata: Metadata = {
  title: "PropGuard AI · Property Transaction Verification",
  description:
    "Know a property deal is genuine before you sign. PropGuard AI keeps tamper-proof land records on a blockchain and uses AI agents to check every sale for warning signs."
};

export default function LandingPage() {
  return (
    <div className="min-h-full flex-1 overflow-y-auto bg-surface-canvas">
      <main>
        <HeroSection />
        <LandingSections />
      </main>
      <LandingFooter />
    </div>
  );
}
