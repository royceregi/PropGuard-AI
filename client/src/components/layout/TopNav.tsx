"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import { getPageTitle } from "@/components/layout/nav";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/auth/roles";

export function TopNav({
  collapsed,
  onMenuClick,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onMenuClick: () => void;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname);
  const { user, logout } = useAuth();
  const [showSecurityPopover, setShowSecurityPopover] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    await logout();
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex h-14 w-full items-center gap-2 border-b border-surface-subtle bg-surface px-3 text-text-primary sm:h-16 sm:gap-3 sm:px-4 lg:gap-6 lg:px-6 xl:px-8">
      <button
        type="button"
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary md:hidden"
      >
        <Icons.Menu className="h-5 w-5 text-[20px]" />
      </button>

      <button
        type="button"
        aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        aria-expanded={!collapsed}
        onClick={onToggleCollapse}
        className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary md:inline-flex"
      >
        <Icons.Menu className="h-5 w-5 text-[20px]" />
      </button>

      <div className="flex min-w-0 shrink items-center gap-2 sm:gap-3">
        <h1 className="truncate text-base font-bold tracking-tight text-text-primary sm:text-lg lg:text-xl">
          {title}
        </h1>
        <span className="hidden rounded-full bg-surface-subtle px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-text-muted sm:inline-flex">
          SAMPLE DATA
        </span>
      </div>

      {pathname.startsWith("/dashboard") && user?.role !== "PUBLIC_USER" ? (
        <div className="relative hidden min-w-0 flex-1 md:block">
          <Icons.Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[20px] text-text-muted" />
          <input
            type="text"
            placeholder="Search Wallet, TxID, Property Hash..."
            className="h-9 w-full max-w-xs rounded-full border border-border-subtle bg-surface-canvas py-1.5 pl-10 pr-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-outline focus:bg-surface lg:max-w-xl xl:max-w-2xl"
          />
        </div>
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
        {user?.role && user.role !== "PUBLIC_USER" ? (
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-black p-2 text-sm font-medium text-text-inverse transition-colors hover:bg-gray-800 sm:px-3 lg:px-4 lg:py-2"
          >
            <Icons.Add className="h-5 w-5 text-[20px]" />
            <span className="hidden lg:inline">Start New Investigation</span>
          </button>
        ) : null}

        <div className="hidden items-center gap-2 rounded-full bg-surface-subtle px-3 py-1.5 text-xs text-text-secondary xl:flex">
          <span className="h-2 w-2 rounded-full bg-success" />
          <span>
            System Status:{" "}
            <span className="font-medium text-success">Active</span>
          </span>
        </div>

        <button
          type="button"
          title="Log Out"
          aria-label="Log out"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-60"
        >
          <Icons.Logout className="h-6 w-6 text-[24px]" />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="relative p-1 text-text-muted transition-colors hover:text-text-primary"
        >
          <Icons.Notifications className="h-6 w-6 text-[24px]" />
          <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
        </button>

        <div className="relative">
          <button
            type="button"
            aria-label="Security"
            onClick={() => setShowSecurityPopover(!showSecurityPopover)}
            className="p-1 text-text-muted transition-colors hover:text-text-primary"
          >
            <Icons.VerifiedUser className="h-6 w-6 text-[24px]" />
          </button>

          {showSecurityPopover && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-surface-subtle bg-surface p-4 shadow-lg z-50">
              <div className="mb-2 flex items-center gap-2">
                <Icons.VerifiedUser className="h-5 w-5 text-success" />
                <h3 className="font-semibold text-text-primary">
                  Secured by PropGuard AI
                </h3>
              </div>
              <p className="text-xs text-text-secondary">
                AI-Powered Blockchain Property Transaction Verification and Risk
                Detection System
              </p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2 pl-1">
          <div
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary sm:h-9 sm:w-9"
          >
            {initialsFromName(user?.full_name)}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="max-w-[9rem] truncate text-sm font-medium text-text-primary">
              {user?.full_name ?? "Signed in"}
            </p>
            {user?.role ? (
              <p className="truncate text-[11px] font-medium text-text-muted">
                {ROLE_LABELS[user.role]}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) {
    return "PG";
  }
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "PG";
}
