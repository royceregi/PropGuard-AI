"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountStatusToggle } from "@/components/users/AccountStatusToggle";
import { labelForAccessLevel } from "@/lib/auth/roles";
import {
  SYSTEM_END_USER_LEVELS,
  formatDateTime,
  isPendingAccessLevel,
  shortenHash,
  shortenWallet,
  type ManagedUser
} from "@/lib/users/types";

interface UserSummaryDrawerProps {
  user: ManagedUser | null;
  open: boolean;
  isSystem?: boolean;
  canManageStatus: boolean;
  canTogglePending?: boolean;
  canSetAccessLevel?: boolean;
  statusBusy?: boolean;
  levelBusy?: boolean;
  onClose: () => void;
  onToggleActive: (nextActive: boolean) => void;
  /** Registry/company: true = submit for approval (Pending), false = Standard. */
  onToggleRegular?: (submitForApproval: boolean) => void;
  onAccessLevelChange?: (accessLevel: string) => void;
}

export function UserSummaryDrawer({
  user,
  open,
  isSystem = false,
  canManageStatus,
  canTogglePending = false,
  canSetAccessLevel = false,
  statusBusy = false,
  levelBusy = false,
  onClose,
  onToggleActive,
  onToggleRegular,
  onAccessLevelChange
}: UserSummaryDrawerProps) {
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

  if (!open || !user) {
    return null;
  }

  const username = user.username?.trim();
  const profileHref = username
    ? `/users/${encodeURIComponent(username)}`
    : null;
  const level = (user.access_level || "").toUpperCase();
  const pending = isPendingAccessLevel(user.access_level);
  const selectValue = SYSTEM_END_USER_LEVELS.includes(
    level as (typeof SYSTEM_END_USER_LEVELS)[number]
  )
    ? level
    : level || "STANDARD";

  return (
    <aside
      role="complementary"
      aria-labelledby="user-summary-panel-title"
      className="flex h-full min-h-[28rem] w-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface lg:min-h-0"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2
            id="user-summary-panel-title"
            className="truncate text-base font-semibold text-text-primary"
          >
            {user.full_name?.trim() || "Unnamed user"}
          </h2>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {username ? `@${username}` : "No username"} · {user.user_id}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
        >
          <Icons.Close className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          {isSystem ? (
            <StatusBadge
              label={labelForAccessLevel(user.access_level)}
              variant={level === "ELEVATED" ? "warning" : "info"}
              size="sm"
            />
          ) : level === "PUBLIC" ? (
            <StatusBadge label="Approved" variant="success" size="sm" />
          ) : (
            <StatusBadge
              label={pending ? "Pending" : "Not submitted"}
              variant={pending ? "warning" : "neutral"}
              size="sm"
            />
          )}
          <StatusBadge
            label={user.is_active ? "Active" : "Inactive"}
            variant={user.is_active ? "success" : "warning"}
            size="sm"
          />
          <StatusBadge
            label={user.mfa_enabled ? "MFA On" : "MFA Off"}
            variant="neutral"
            size="sm"
          />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-subtle pt-4">
          <SummaryField
            label="NIC Hash"
            value={shortenHash(user.nic_hash)}
            mono
          />
          <SummaryField label="Username" value={user.username} />
          <SummaryField label="Email" value={user.email} />
          <SummaryField label="Phone" value={user.phone_number} />
          {isSystem ? (
            <SummaryField
              label="Access Level"
              value={labelForAccessLevel(user.access_level)}
            />
          ) : null}
          <SummaryField
            label="Wallet"
            value={shortenWallet(user.wallet_address)}
            mono
          />
          <SummaryField
            label="Created"
            value={formatDateTime(user.created_at)}
          />
          <SummaryField
            label="Last Login"
            value={formatDateTime(user.last_login)}
          />
        </dl>

        {canSetAccessLevel && onAccessLevelChange ? (
          <div className="mt-5 border-t border-border-subtle pt-4">
            <label className="block text-sm font-medium text-text-primary">
              Access level
            </label>
            <p className="mt-1 text-xs text-text-muted">
              Promote Pending → Public to grant system access. Standard has no
              login until approved.
            </p>
            <select
              value={selectValue}
              disabled={levelBusy}
              onChange={(event) => onAccessLevelChange(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
            >
              {!SYSTEM_END_USER_LEVELS.includes(
                selectValue as (typeof SYSTEM_END_USER_LEVELS)[number]
              ) ? (
                <option value={selectValue}>
                  {labelForAccessLevel(selectValue)}
                </option>
              ) : null}
              {SYSTEM_END_USER_LEVELS.map((item) => (
                <option key={item} value={item}>
                  {labelForAccessLevel(item)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {canTogglePending && onToggleRegular && level !== "PUBLIC" ? (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Submit for approval
              </p>
              <p className="text-xs text-text-muted">
                {pending
                  ? "Pending Super Admin review"
                  : "Off = Standard (no access)"}
              </p>
            </div>
            <AccountStatusToggle
              checked={pending}
              busy={levelBusy}
              onToggle={onToggleRegular}
            />
          </div>
        ) : null}

        {canManageStatus ? (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <div>
              <p className="text-sm font-medium text-text-primary">
                Account status
              </p>
              <p className="text-xs text-text-muted">
                {user.is_active ? "Active" : "Inactive"}
              </p>
            </div>
            <AccountStatusToggle
              checked={user.is_active}
              busy={statusBusy}
              onToggle={onToggleActive}
            />
          </div>
        ) : null}
      </div>

      <div className="border-t border-border-subtle px-4 py-4 sm:px-5">
        {profileHref ? (
          <Link
            href={profileHref}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-text-inverse transition-colors hover:bg-primary-hover"
          >
            View Profile
            <Icons.ArrowForward className="h-4 w-4" />
          </Link>
        ) : (
          <p className="text-center text-sm text-text-muted">
            No username available for full profile.
          </p>
        )}
      </div>
    </aside>
  );
}

function SummaryField({
  label,
  value,
  mono
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-text-muted">{label}</dt>
      <dd
        className={`mt-0.5 truncate text-sm text-text-primary ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value?.trim() ? value : "—"}
      </dd>
    </div>
  );
}
