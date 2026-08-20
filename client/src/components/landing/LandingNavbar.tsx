"use client";

import Link from "next/link";
import { useState } from "react";
import { Icons } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, homeForRole } from "@/lib/auth/roles";

const NAV_LINKS = [
  { href: "#solutions", label: "Solutions" },
  { href: "#architecture", label: "Core Architecture" },
  { href: "#demo", label: "Live Verification Demo" },
  { href: "#about", label: "About" },
] as const;

export function LandingNavbar() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const dashboardHref = user ? homeForRole(user.role) : "/login";

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#04111f]/90 backdrop-blur-xl">
      {isAuthenticated && user ? (
        <div className="border-b border-primary/20 bg-primary/10">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs text-primary-200 sm:px-6">
            <p>
              Logged in as{" "}
              <span className="font-semibold text-white">
                {user.full_name ?? "Signed-in user"}
              </span>{" "}
              ({ROLE_LABELS[user.role]})
            </p>
            <Link
              href={dashboardHref}
              className="inline-flex items-center gap-1 font-semibold text-secondary hover:text-white"
            >
              Go to Dashboard
              <Icons.ArrowForward className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <Icons.Shield className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold tracking-wide text-white">
              PropGuard AI
            </span>
            <span className="block text-[10px] font-semibold tracking-[0.14em] text-secondary uppercase">
              Blockchain + Multi-Agent AI
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-slate-300 lg:flex">
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={isAuthenticated ? dashboardHref : "/login"}
            className="hidden h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-hover sm:inline-flex"
          >
            {isAuthenticated ? "Access Platform" : "Login with NIC"}
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-white lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <Icons.Close className="h-5 w-5" />
            ) : (
              <Icons.Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-white/10 px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-slate-300">
            {NAV_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2 hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
            <Link
              href={isAuthenticated ? dashboardHref : "/login"}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-white"
            >
              {isAuthenticated ? "Access Platform" : "Login with NIC"}
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
