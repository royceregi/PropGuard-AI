"use client";

import { Icons } from "@/components/icons";

const PILLARS = [
  {
    icon: Icons.Balance,
    audience: "Land Registries & Regulators",
    title: "Official investigation workspace",
    body: "Official investigation and integrity-checking workspace. Resolve flagged transactions, verify cryptographic document hashes, and audit historical ownership chains with full transparency.",
  },
  {
    icon: Icons.Business,
    audience: "Real Estate Companies & Financial Institutions",
    title: "Pre-transaction due diligence passbook",
    body: "Pre-transaction due diligence passbook. Check active encumbrances, detect anomalous price variations against regional historical baselines, and verify seller-owner authenticity before closing deals.",
  },
  {
    icon: Icons.VerifiedUser,
    audience: "Property Owners & Public Stakeholders",
    title: "Digital title passbook",
    body: "Digital title passbook. Verify personal property deeds, track immutable transaction status, and ensure private title records remain tamper-evident.",
  },
] as const;

export function SolutionsGrid() {
  return (
    <section
      id="solutions"
      className="scroll-mt-28 bg-surface-canvas px-4 py-16 sm:px-6 lg:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Commercialization
        </p>
        <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          One verification platform, three institutional audiences
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
          PropGuard AI is not a listings marketplace. It is a property
          transaction intelligence and verification workspace for registries,
          enterprises, and title holders.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.audience}
                className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="mt-5 text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
                  {pillar.audience}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-text-primary">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  {pillar.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
