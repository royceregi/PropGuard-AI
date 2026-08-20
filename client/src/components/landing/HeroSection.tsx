"use client";

import { Icons } from "@/components/icons";
import { HeroActions } from "@/components/landing/HeroActions";
import { VerificationPreviewCard } from "@/components/landing/VerificationPreviewCard";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[#04111f] px-4 pt-14 pb-20 sm:px-6 lg:pt-20 lg:pb-24">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:32px_32px]" />
      <div className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-secondary uppercase">
            <Icons.AccountBalance className="h-3.5 w-3.5" />
            Protecting Property Transactions with AI + Blockchain
          </p>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
            AI-Powered Blockchain Verification &amp; Fraud-Risk Detection for
            Land Transactions
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            Empowering land registries, real estate enterprises, and property
            owners with tamper-evident blockchain ledger validation, multi-agent
            intelligence, and explainable risk analysis.
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-400">
            PropGuard AI is an enterprise verification and decision-support
            workspace. It checks cryptographic integrity and surfaces
            explainable risk indicators — it does not issue automated legal
            fraud judgments or replace statutory land-registry authority.
          </p>
          <HeroActions />
        </div>

        <div id="demo" className="scroll-mt-28">
          <VerificationPreviewCard />
        </div>
      </div>
    </section>
  );
}
