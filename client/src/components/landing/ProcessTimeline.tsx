"use client";

import { Icons } from "@/components/icons";

const STEPS = [
  {
    step: "01",
    title: "Retrieve",
    icon: Icons.FindInPage,
    body: "Structured and semantic information retrieval over historical deeds, ownership records, and ledger entries.",
  },
  {
    step: "02",
    title: "Verify",
    icon: Icons.Shield,
    body: "SHA-256 document hash comparison and cryptographic blockchain previous-hash chaining for tamper-evident integrity.",
  },
  {
    step: "03",
    title: "Risk Analysis",
    icon: Icons.WarningAmber,
    body: "Explainable rule-based checks and anomaly detection for ownership, encumbrance, and price deviations.",
  },
  {
    step: "04",
    title: "Multi-Agent Report",
    icon: Icons.SmartToy,
    body: "Collaborative agent orchestration delivering actionable, evidence-backed investigation reports for human review.",
  },
] as const;

export function ProcessTimeline() {
  return (
    <section
      id="architecture"
      className="scroll-mt-28 bg-white px-4 py-16 sm:px-6 lg:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Core architecture
        </p>
        <h2 className="mt-2 max-w-2xl text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          How the verification workspace operates
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
          Retrieve, verify, analyse, then report. Each stage is designed for
          auditability rather than opaque automation.
        </p>

        <ol className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.step}
                className="relative rounded-2xl border border-border-subtle bg-surface-canvas p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold tracking-widest text-primary">
                    {item.step}
                  </span>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold text-text-primary">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {item.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
