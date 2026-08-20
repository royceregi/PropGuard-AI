"use client";

import { Icons } from "@/components/icons";

const PRINCIPLES = [
  {
    icon: Icons.Visibility,
    title: "Explainability",
    body: "Risk outputs include indicator-level reasons, not a hidden score.",
  },
  {
    icon: Icons.Balance,
    title: "Transparency",
    body: "Hash checks, chain status, and evidence remain inspectable in the workspace.",
  },
  {
    icon: Icons.Gavel,
    title: "Fairness",
    body: "Anomalous patterns are flagged for review; the system does not label legal guilt.",
  },
  {
    icon: Icons.Lock,
    title: "Privacy",
    body: "Personally identifiable fields stay masked outside authorised investigation views.",
  },
  {
    icon: Icons.HowToReg,
    title: "Human oversight",
    body: "Registry and enterprise officers remain the decision-makers of record.",
  },
] as const;

export function TrustBanner() {
  return (
    <section
      id="about"
      className="scroll-mt-28 bg-[#04111f] px-4 py-16 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-secondary uppercase">
          Responsible AI &amp; trust
        </p>
        <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Decision support with explicit human authority
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">
          PropGuard AI provides tamper-evident integrity checks, explainable
          risk indicators, and investigation reports. It is not an automated
          legal tribunal and does not replace statutory government land
          authorities.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {PRINCIPLES.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <Icon className="h-5 w-5 text-secondary" />
                <h3 className="mt-3 text-sm font-semibold text-white">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {item.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
