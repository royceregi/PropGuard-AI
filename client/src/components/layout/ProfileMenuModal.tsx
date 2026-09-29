"use client";

import { useEffect } from "react";
import { Icons } from "@/components/icons";
import { ACCESS_LABELS } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";

export type ProfileMenuAction =
  "profile" | "settings" | "change-password" | "logout";

interface ProfileMenuModalProps {
  open: boolean;
  user: AuthUser | null;
  loggingOut?: boolean;
  onClose: () => void;
  onAction: (action: ProfileMenuAction) => void;
}

const MENU_ITEMS: {
  action: ProfileMenuAction;
  label: string;
  icon: keyof typeof Icons;
  tone?: "danger";
  levels?: Array<"SYSTEM" | "REGISTRY" | "COMPANY" | "PUBLIC">;
}[] = [
  { action: "profile", label: "Profile", icon: "ManageAccounts" },
  {
    action: "settings",
    label: "Account settings",
    icon: "Settings",
    levels: ["SYSTEM"]
  },
  { action: "change-password", label: "Change password", icon: "Lock" },
  { action: "logout", label: "Logout", icon: "Logout", tone: "danger" }
];

export function ProfileMenuModal({
  open,
  user,
  loggingOut = false,
  onClose,
  onAction
}: ProfileMenuModalProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-3 sm:p-4">
      <button
        type="button"
        aria-label="Close profile menu"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-menu-title"
        className="relative mt-12 w-full max-w-xs overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-lg sm:mt-14"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3.5">
          <div className="min-w-0">
            <h2
              id="profile-menu-title"
              className="truncate text-sm font-semibold text-text-primary"
            >
              {user?.full_name?.trim() || "Signed in"}
            </h2>
            {user?.email ? (
              <p className="mt-0.5 truncate text-xs text-text-muted">
                {user.email}
              </p>
            ) : null}
            {user?.access_level ? (
              <p className="mt-1 text-[11px] font-medium text-text-secondary">
                {ACCESS_LABELS[user.access_level] ?? user.access_level}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
          >
            <Icons.Close className="h-4 w-4" />
          </button>
        </div>

        <div className="p-2" role="menu" aria-label="Profile options">
          {MENU_ITEMS.filter((item) => {
            if (!item.levels || item.levels.length === 0) {
              return true;
            }
            return user?.access_level
              ? (item.levels as string[]).includes(user.access_level)
              : false;
          }).map((item) => {
            const Icon = Icons[item.icon];
            const isLogout = item.action === "logout";
            return (
              <button
                key={item.action}
                type="button"
                role="menuitem"
                disabled={isLogout && loggingOut}
                onClick={() => onAction(item.action)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors disabled:opacity-60 ${
                  item.tone === "danger"
                    ? "text-danger hover:bg-danger/10"
                    : "text-text-primary hover:bg-surface-subtle"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0 text-[20px]" />
                <span>
                  {isLogout && loggingOut ? "Signing out…" : item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
