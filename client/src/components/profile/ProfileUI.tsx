"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import { ACCESS_LABELS } from "@/lib/auth/roles";
import { useAuthStore } from "@/lib/auth/store";
import type { AuthUser } from "@/lib/auth/types";
import { toast } from "@/lib/toast";
import { formatDateTime, shortenWallet } from "@/lib/users/types";

interface ProfileRecord {
  user_id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  access_level: string;
  wallet_address: string | null;
  mfa_enabled: boolean;
  is_active?: boolean;
  last_login: string | null;
}

function display(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function ProfileUI() {
  const searchParams = useSearchParams();
  const { user: sessionUser } = useAuth();
  const setSession = useAuthStore((state) => state.setSession);
  const token = useAuthStore((state) => state.token);
  const passwordSectionRef = useRef<HTMLElement | null>(null);

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<ProfileRecord>("/api/auth/me");
        if (cancelled) {
          return;
        }
        setProfile(data);
        setFullName(data.full_name?.trim() ?? "");
        setPhoneNumber(data.phone_number?.trim() ?? "");
      } catch (err) {
        if (cancelled) {
          return;
        }
        setProfile(null);
        setError(
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Unable to load your profile."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const section = searchParams.get("section");
    if (section !== "password" || loading) {
      return;
    }
    passwordSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, [searchParams, loading]);

  function syncSession(next: ProfileRecord) {
    if (!sessionUser) {
      return;
    }
    const updated: AuthUser = {
      ...sessionUser,
      full_name: next.full_name,
      email: next.email,
      access_level: next.access_level as AuthUser["access_level"],
      wallet_address: next.wallet_address,
      username: next.username,
      phone_number: next.phone_number,
      mfa_enabled: next.mfa_enabled,
      last_login: next.last_login
    };
    setSession(updated, token);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = fullName.trim();
    if (!name) {
      toast.error("Full name is required.");
      return;
    }

    setSavingProfile(true);
    try {
      const { data } = await api.patch<ProfileRecord>("/api/auth/me", {
        full_name: name,
        phone_number: phoneNumber.trim() || null
      });
      setProfile(data);
      setFullName(data.full_name?.trim() ?? "");
      setPhoneNumber(data.phone_number?.trim() ?? "");
      syncSession(data);
      setEditing(false);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(
        isAxiosError(err) && typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "Unable to update profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await api.post("/api/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully.");
    } catch (err) {
      toast.error(
        isAxiosError(err) && typeof err.response?.data?.detail === "string"
          ? err.response.data.detail
          : "Unable to change password."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8">
        <p className="text-sm text-text-muted">Loading profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8">
        <p role="alert" className="text-sm text-danger">
          {error ?? "Profile not found."}
        </p>
      </div>
    );
  }

  const roleLabel =
    ACCESS_LABELS[profile.access_level as keyof typeof ACCESS_LABELS] ??
    profile.access_level;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-3 sm:p-4 lg:p-6 xl:p-8">
      <header className="flex flex-col gap-3 border-b border-border-subtle pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">
            {display(profile.full_name)}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            @{display(profile.username)} · {profile.user_id}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusBadge label={roleLabel} variant="info" size="sm" />
            <StatusBadge
              label={profile.mfa_enabled ? "MFA On" : "MFA Off"}
              variant="neutral"
              size="sm"
            />
          </div>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-subtle"
          >
            <Icons.ManageAccounts className="h-4 w-4" />
            Edit profile
          </button>
        ) : null}
      </header>

      <section className="rounded-xl border border-border bg-surface p-5 md:p-6">
        <h2 className="mb-5 text-lg font-bold text-text-primary">
          Account details
        </h2>

        {editing ? (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField label="User ID" value={profile.user_id} mono />
              <ReadOnlyField
                label="Username"
                value={display(profile.username)}
              />
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                  Full name
                </span>
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  maxLength={255}
                  className="h-10 w-full rounded-lg border border-border bg-surface-canvas px-3 text-sm text-text-primary outline-none focus:border-outline"
                />
              </label>
              <ReadOnlyField label="Email" value={display(profile.email)} />
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
                  Phone number
                </span>
                <input
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  maxLength={50}
                  placeholder="Optional"
                  className="h-10 w-full rounded-lg border border-border bg-surface-canvas px-3 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-outline"
                />
              </label>
              <ReadOnlyField label="Role" value={roleLabel} />
              <ReadOnlyField
                label="Wallet address"
                value={shortenWallet(profile.wallet_address)}
                mono
              />
              <ReadOnlyField
                label="MFA enabled"
                value={profile.mfa_enabled ? "Yes" : "No"}
              />
              <ReadOnlyField
                label="Last login"
                value={formatDateTime(profile.last_login)}
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                {savingProfile ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => {
                  setEditing(false);
                  setFullName(profile.full_name?.trim() ?? "");
                  setPhoneNumber(profile.phone_number?.trim() ?? "");
                }}
                className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface-subtle disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadOnlyField label="User ID" value={profile.user_id} mono />
            <ReadOnlyField label="Username" value={display(profile.username)} />
            <ReadOnlyField
              label="Full name"
              value={display(profile.full_name)}
            />
            <ReadOnlyField label="Email" value={display(profile.email)} />
            <ReadOnlyField
              label="Phone number"
              value={display(profile.phone_number)}
            />
            <ReadOnlyField label="Role" value={roleLabel} />
            <ReadOnlyField
              label="Wallet address"
              value={shortenWallet(profile.wallet_address)}
              mono
            />
            <ReadOnlyField
              label="MFA enabled"
              value={profile.mfa_enabled ? "Yes" : "No"}
            />
            <ReadOnlyField
              label="Last login"
              value={formatDateTime(profile.last_login)}
            />
          </div>
        )}
      </section>

      <section
        ref={passwordSectionRef}
        id="change-password"
        className="rounded-xl border border-border bg-surface p-5 md:p-6"
      >
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-text-primary">
          <Icons.Lock className="h-5 w-5 text-text-muted" />
          Change password
        </h2>
        <p className="mb-5 text-sm text-text-secondary">
          Enter your current password, then choose a new password (at least 8
          characters).
        </p>
        <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
              Current password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              minLength={8}
              className="h-10 w-full rounded-lg border border-border bg-surface-canvas px-3 text-sm text-text-primary outline-none focus:border-outline"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
              New password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={8}
              className="h-10 w-full rounded-lg border border-border bg-surface-canvas px-3 text-sm text-text-primary outline-none focus:border-outline"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
              Confirm new password
            </span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={8}
              className="h-10 w-full rounded-lg border border-border bg-surface-canvas px-3 text-sm text-text-primary outline-none focus:border-outline"
            />
          </label>
          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-text-inverse transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            <Icons.Lock className="h-4 w-4" />
            {savingPassword ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wider text-text-muted uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 break-all text-sm text-text-primary ${
          mono ? "font-mono text-xs" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
