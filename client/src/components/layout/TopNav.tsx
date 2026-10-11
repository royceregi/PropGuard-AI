"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import { getPageTitle } from "@/components/layout/nav";
import {
  ProfileMenuModal,
  type ProfileMenuAction
} from "@/components/layout/ProfileMenuModal";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { NewInvestigationMenu } from "@/components/layout/NewInvestigationMenu";
import { NotificationsPopover } from "@/components/layout/NotificationsPopover";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { ACCESS_LABELS } from "@/lib/auth/roles";
import { isOperationalAccessLevel } from "@/lib/auth/types";

export function TopNav({
  collapsed,
  onMenuClick,
  onToggleCollapse
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
  const [showStatusPopover, setShowStatusPopover] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [verifiedAt] = useState(() => new Date());
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showStatusPopover) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        statusRef.current &&
        !statusRef.current.contains(event.target as Node)
      ) {
        setShowStatusPopover(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showStatusPopover]);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    setShowProfileModal(false);
    await logout();
    router.replace("/");
    router.refresh();
  }

  function handleProfileAction(action: ProfileMenuAction) {
    if (action === "logout") {
      void handleLogout();
      return;
    }

    setShowProfileModal(false);

    if (action === "profile") {
      router.push("/profile");
      return;
    }

    if (action === "settings") {
      router.push("/settings");
      return;
    }

    if (action === "change-password") {
      router.push("/profile?section=password");
    }
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
      </div>

      {user && isOperationalAccessLevel(user.access_level) ? (
        <GlobalSearch accessLevel={user.access_level} />
      ) : null}

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3 lg:gap-4">
        {user && isOperationalAccessLevel(user.access_level) ? (
          <NewInvestigationMenu accessLevel={user.access_level} />
        ) : null}

        <div className="relative hidden sm:block" ref={statusRef}>
          <button
            type="button"
            aria-expanded={showStatusPopover}
            aria-haspopup="dialog"
            onClick={() => {
              setShowSecurityPopover(false);
              setShowStatusPopover((open) => !open);
            }}
            className="flex items-center gap-2 rounded-full bg-surface-subtle px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-muted"
          >
            <span className="h-2 w-2 rounded-full bg-success" />
            <span>
              System Status:{" "}
              <span className="font-medium text-success">Active</span>
            </span>
          </button>

          {showStatusPopover ? (
            <div
              role="dialog"
              aria-label="System status details"
              className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border-subtle bg-surface p-3.5 shadow-lg"
            >
              <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <span className="h-2 w-2 rounded-full bg-success" />
                Connected
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                Ledger integrity verified
                {verifiedAt ? ` on ${formatVerifiedAt(verifiedAt)}.` : "."}
              </p>
            </div>
          ) : null}
        </div>

        <NotificationsPopover />

        <div className="relative">
          <button
            type="button"
            aria-label="Security"
            onClick={() => {
              setShowStatusPopover(false);
              setShowSecurityPopover(!showSecurityPopover);
            }}
            className="p-1 text-text-muted transition-colors hover:text-text-primary"
          >
            <Icons.VerifiedUser className="h-6 w-6 text-[24px]" />
          </button>

          {showSecurityPopover && (
            <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-surface-subtle bg-surface p-4 shadow-lg">
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

        <ThemeToggle />

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
          aria-label="Open profile menu"
          aria-haspopup="dialog"
          aria-expanded={showProfileModal}
          onClick={() => {
            setShowSecurityPopover(false);
            setShowStatusPopover(false);
            setShowProfileModal(true);
          }}
          className="flex min-w-0 items-center gap-2 rounded-lg py-1 pl-1 pr-1 transition-colors hover:bg-surface-subtle sm:pr-2"
        >
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
            {user?.access_level ? (
              <p className="truncate text-[11px] font-medium text-text-muted">
                {ACCESS_LABELS[user.access_level] ?? user.access_level}
              </p>
            ) : null}
          </div>
        </button>
      </div>

      <ProfileMenuModal
        open={showProfileModal}
        user={user}
        loggingOut={loggingOut}
        onClose={() => setShowProfileModal(false)}
        onAction={handleProfileAction}
      />
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

function formatVerifiedAt(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}
