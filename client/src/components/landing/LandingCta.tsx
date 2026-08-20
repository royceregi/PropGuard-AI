"use client";

import Link from "next/link";
import { Icons } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { homeForRole } from "@/lib/auth/roles";

export function LandingCta() {
  const { user, isAuthenticated } = useAuth();
  const href = isAuthenticated && user ? homeForRole(user.role) : "/login";

  return (
    <section className="bg-surface-canvas px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-3xl border border-border-subtle bg-white px-6 py-12 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)] sm:px-12">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          Ready to verify your first property transaction?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-secondary">
          Sign in with your National Identity Card to open the role-based
          verification workspace for registry, enterprise, or public title
          holders.
        </p>
        <Link
          href={href}
          className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {isAuthenticated ? "Go to Dashboard" : "Login with NIC"}
          <Icons.ArrowForward className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
