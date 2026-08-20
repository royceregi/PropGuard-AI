"use client";

import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";

export function VerificationPreviewCard() {
  return (
    <article
      aria-label="Sample verification summary"
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#07111d] p-5 text-left shadow-[0_24px_60px_rgba(0,20,50,0.35)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_42%)]" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-secondary uppercase">
            Live verification demo
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">
            Transaction integrity summary
          </h3>
        </div>
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-secondary">
          <Icons.VerifiedUser className="h-5 w-5" />
        </span>
      </div>

      <dl className="relative mt-5 space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
          <dt className="text-xs text-slate-400">Transaction ID</dt>
          <dd className="font-mono text-sm font-medium tracking-wide text-white">
            TX-10231
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
          <dt className="text-xs text-slate-400">Blockchain Integrity</dt>
          <dd>
            <StatusBadge label="VALID" variant="success" size="sm" />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
          <dt className="text-xs text-slate-400">Hash Chain</dt>
          <dd className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            <span className="text-sm font-semibold text-success">OK</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-success/20 bg-success/10 px-3.5 py-3">
          <dt className="text-xs text-slate-400">Risk Score</dt>
          <dd className="text-sm font-semibold text-success">0.12 — LOW</dd>
        </div>
      </dl>

      <p className="relative mt-4 text-[11px] leading-relaxed text-slate-400">
        Illustrative workspace output. PropGuard AI supports investigation
        decisions; it does not issue legal determinations.
      </p>
    </article>
  );
}
