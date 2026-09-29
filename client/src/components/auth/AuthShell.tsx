"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Icons } from "@/components/icons";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function ClientOnlyIcon({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  const isClient = useIsClient();
  if (!isClient) {
    return <span className={className} aria-hidden />;
  }
  return children;
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">{children}</div>
    </div>
  );
}

export function AuthBrandHeader() {
  return (
    <header className="mb-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-text-inverse shadow-sm">
        <ClientOnlyIcon className="inline-block h-7 w-7">
          <Icons.VerifiedUser className="text-[28px]" />
        </ClientOnlyIcon>
      </div>
      <h1 className="text-xl font-bold tracking-[0.14em] text-text-primary">
        PROPGUARD AI
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Property Transaction Intelligence and Verification Platform
      </p>
    </header>
  );
}

export function AuthSecurityBadge() {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 border-t border-border-subtle pt-5 text-center sm:flex-row sm:justify-center sm:gap-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Multi-Agent Sentinel: Active
      </span>
      <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary">
        <ClientOnlyIcon className="inline-block h-4 w-4">
          <Icons.Verified className="text-[16px] text-primary" />
        </ClientOnlyIcon>
        Ethereum / Layer 2 Verified
      </span>
    </div>
  );
}
