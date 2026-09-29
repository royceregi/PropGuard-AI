"use client";

import Link from "next/link";
import { Icons } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { homeForAccessLevel } from "@/lib/auth/roles";
import { isOperationalAccessLevel } from "@/lib/auth/types";

export function HeroSection() {
  const { user, isAuthenticated } = useAuth();
  const workspaceHref =
    isAuthenticated && user && isOperationalAccessLevel(user.access_level)
      ? homeForAccessLevel(user.access_level)
      : "/login";
  const ctaLabel = isAuthenticated ? "Open Workspace" : "Sign In";

  return (
    <section className="relative flex min-h-dvh flex-col overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
          backgroundSize: "50px 50px"
        }}
      />
      <div className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />

      <div className="relative z-10 flex shrink-0 items-center justify-end px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href={workspaceHref}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {ctaLabel}
          <Icons.ArrowForward className="h-4 w-4" />
        </Link>
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-8 sm:px-6 lg:pb-10">
        <div className="flex shrink-0 flex-col items-center pt-2 text-center sm:pt-4">
          <h1 className="text-3xl font-light tracking-tight text-white sm:text-5xl md:text-6xl md:leading-[0.95]">
            Welcome To PropGuard AI
            <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
          </h1>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-medium tracking-[0.08em] text-white/40 uppercase sm:mt-8 sm:gap-10 sm:text-sm">
            <div className="flex items-center gap-3">
              <Icons.Shield className="h-4 w-4 text-secondary" />
              <span>Immutable</span>
            </div>
            <div className="hidden h-5 w-px bg-white/20 sm:block" />
            <div className="flex items-center gap-3">
              <Icons.HourglassEmpty className="h-4 w-4 text-secondary" />
              <span>Instant Verification</span>
            </div>
            <div className="hidden h-5 w-px bg-white/20 sm:block" />
            <div className="flex items-center gap-3">
              <Icons.ViewInAr className="h-4 w-4 text-secondary" />
              <span>Blockchain Ledger</span>
            </div>
          </div>
        </div>

        <div className="relative mx-auto mt-10 flex w-full max-w-4xl flex-1 flex-col sm:mt-14 lg:mt-16">
          <article className="relative flex flex-1 flex-col overflow-hidden rounded-3xl border border-white/25 bg-white/8 p-8 shadow-2xl backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-white/12 sm:p-10 lg:p-12">
            <div className="relative z-10 flex flex-1 flex-col justify-between gap-8 text-center sm:gap-10">
              <div className="flex items-start justify-between gap-4">
                <div className="text-left">
                  <div className="text-sm font-medium tracking-wider text-white/40 uppercase">
                    PropGuard AI
                  </div>
                  <div className="mt-1 h-px w-12 bg-secondary/60" />
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium tracking-wider text-white/40 uppercase">
                    Blockchain Verified
                  </div>
                  <div className="mt-1 ml-auto h-px w-12 bg-secondary/60" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-6 sm:gap-8">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/20 backdrop-blur-sm sm:h-20 sm:w-20">
                  <div className="h-7 w-7 rounded-full bg-secondary/70 sm:h-8 sm:w-8" />
                  <div className="absolute inset-0 animate-ping rounded-full border border-secondary/30" />
                </div>

                <h3 className="text-2xl font-light tracking-wide text-white/90 sm:text-3xl">
                  PROPERTY TRANSACTION INTEGRITY
                </h3>

                <div className="mx-auto w-full max-w-2xl space-y-5 sm:space-y-6">
                  <div className="h-px rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                  <div className="space-y-3 font-light leading-relaxed text-white/70">
                    <p className="text-lg">This verifies that</p>
                    <p className="text-xl font-medium text-white/90 sm:text-2xl">
                      &quot;Deed Transfer TX-2023-10425&quot;
                    </p>
                    <p>is cryptographically secured on the ledger</p>
                  </div>

                  <div className="h-px rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </div>
              </div>

              <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-8">
                <div className="text-left">
                  <div className="mb-2 text-xs font-medium tracking-wider text-white/40 uppercase">
                    Registered To
                  </div>
                  <div className="text-lg font-medium text-white/80">
                    Nimal Perera
                  </div>
                  <div className="font-mono text-sm text-white/50">
                    NIC · 900000004V
                  </div>
                </div>
                <div className="text-right">
                  <div className="mb-2 text-xs font-medium tracking-wider text-white/40 uppercase">
                    Verified By
                  </div>
                  <div className="text-lg font-medium text-white/80">
                    Land Registry
                  </div>
                  <div className="text-sm text-white/50">
                    Authoritative Source
                  </div>
                </div>
              </div>

              <div className="mx-auto grid w-full max-w-2xl grid-cols-3 gap-4 border-t border-white/20 pt-6 text-center sm:gap-6">
                <div>
                  <div className="text-xs font-medium tracking-wider text-white/40 uppercase">
                    Hash
                  </div>
                  <div className="mt-1 font-mono text-sm text-white/70">
                    0x7a9f2b8c...
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium tracking-wider text-white/40 uppercase">
                    Block
                  </div>
                  <div className="mt-1 font-mono text-sm text-white/70">
                    #18,429,847
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium tracking-wider text-white/40 uppercase">
                    Status
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-2 text-sm text-success">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                    Verified
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
