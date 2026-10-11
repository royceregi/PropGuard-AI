"use client";

import Link from "next/link";
import { Icons } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { homeForAccessLevel } from "@/lib/auth/roles";
import { isOperationalAccessLevel } from "@/lib/auth/types";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#ai-agents", label: "AI agents" },
  { href: "#who-its-for", label: "Who it's for" },
  { href: "#faq", label: "FAQ" }
];

export function useWorkspaceLink() {
  const { user, isAuthenticated } = useAuth();
  const href =
    isAuthenticated && user && isOperationalAccessLevel(user.access_level)
      ? homeForAccessLevel(user.access_level)
      : "/login";
  return { href, label: isAuthenticated ? "Open Workspace" : "Sign In" };
}

export function HeroSection() {
  const workspace = useWorkspaceLink();

  return (
    <section className="relative overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.3) 1px, transparent 0)",
          backgroundSize: "50px 50px"
        }}
      />
      <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Icons.AccountBalance className="h-5 w-5 text-white" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            PropGuard AI
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <Link
          href={workspace.href}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {workspace.label}
          <Icons.ArrowForward className="h-4 w-4" />
        </Link>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-16 lg:pb-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
            Blockchain records + AI checks
          </span>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl lg:leading-[1.05]">
            Know a property deal is genuine{" "}
            <span className="text-secondary">before you sign.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
            PropGuard AI keeps a tamper-proof copy of every land record on a
            blockchain, then uses AI to check each sale for warning signs. You
            get a clear answer in plain language: is this record real, and is
            this deal safe?
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={workspace.href}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
            >
              {workspace.label === "Sign In" ? "Get started" : workspace.label}
              <Icons.ArrowForward className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-5 text-sm font-semibold text-white/85 transition-colors hover:border-white/40 hover:text-white"
            >
              See how it works
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/55">
            {[
              "Records can't be secretly changed",
              "Every check is explained",
              "Your data stays private"
            ].map((point) => (
              <li key={point} className="flex items-center gap-2">
                <Icons.CheckCircle className="h-4 w-4 text-secondary" />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <VerificationCard />
      </div>
    </section>
  );
}

export function LandingFooter() {
  const workspace = useWorkspaceLink();

  return (
    <footer className="bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Check before you trust.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white/60">
          Sign in to verify your properties, review shared deals and ask the AI
          Assistant anything about your records.
        </p>
        <Link
          href={workspace.href}
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {workspace.label}
          <Icons.ArrowForward className="h-4 w-4" />
        </Link>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-xs text-white/40 sm:flex-row sm:px-6">
          <span>© {new Date().getFullYear()} PropGuard AI</span>
          <span>Blockchain + Multi-Agent AI for property verification</span>
        </div>
      </div>
    </footer>
  );
}

function VerificationCard() {
  const checks = [
    { label: "Record found on blockchain", ok: true },
    { label: "Documents unchanged since registration", ok: true },
    { label: "Seller is the registered owner", ok: true },
    { label: "Price in normal range for the area", ok: true }
  ];

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="rounded-3xl border border-white/20 bg-white/8 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-white/45 uppercase">
              Sample check
            </p>
            <p className="mt-1 text-lg font-semibold">Villa sale · TX-10425</p>
            <p className="text-sm text-white/50">Al Hebiah Third, Dubai</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
            <Icons.VerifiedUser className="h-3.5 w-3.5" />
            Low risk
          </span>
        </div>

        <ul className="mt-6 space-y-3">
          {checks.map((check) => (
            <li
              key={check.label}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80"
            >
              <Icons.CheckCircle className="h-5 w-5 shrink-0 text-success" />
              {check.label}
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-xl bg-primary/15 p-4 text-sm leading-relaxed text-white/80">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wider text-white/50 uppercase">
            <Icons.AutoAwesome className="h-3.5 w-3.5 text-secondary" />
            AI summary
          </p>
          The record matches the blockchain and the seller owns the property. No
          warning signs were found.
        </div>
      </div>
    </div>
  );
}
