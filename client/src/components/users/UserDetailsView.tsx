"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountStatusToggle } from "@/components/users/AccountStatusToggle";
import { useAuth } from "@/hooks/useAuth";
import { labelForAccessLevel } from "@/lib/auth/roles";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/toast";
import {
  SYSTEM_END_USER_LEVELS,
  formatDateTime,
  isPendingAccessLevel,
  shortenHash,
  type ManagedUser,
  type PaginatedUserRelatedProperties,
  type UserRelatedProperty,
} from "@/lib/users/types";
import { propertyHref, shortenId } from "@/lib/property-search/types";

export function UserDetailsView({ username }: { username: string }) {
  const { user: currentUser } = useAuth();
  const isSystem = currentUser?.access_level === "SYSTEM";
  const isRegistryOrCompany =
    currentUser?.access_level === "REGISTRY" ||
    currentUser?.access_level === "COMPANY";

  const [user, setUser] = useState<ManagedUser | null>(null);
  const [properties, setProperties] = useState<UserRelatedProperty[]>([]);
  const [propertiesTotal, setPropertiesTotal] = useState(0);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [levelBusy, setLevelBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadManagedUser(identifier: string): Promise<ManagedUser> {
      const encoded = encodeURIComponent(identifier);
      // Canonical DB user_ids are uppercase (USER000003). Usernames are lowercase
      // (user000003) — do not treat them as the same.
      const isCanonicalUserId = /^USER\d+$/.test(identifier);

      if (isCanonicalUserId) {
        const { data } = await api.get<ManagedUser>(`/api/v1/users/${encoded}`);
        return data;
      }

      try {
        const { data } = await api.get<ManagedUser>(
          `/api/v1/users/by-username/${encoded}`,
        );
        return data;
      } catch (err) {
        if (isAxiosError(err) && err.response?.status === 404) {
          const asUserId = /^user\d+$/i.test(identifier)
            ? identifier.toUpperCase()
            : identifier;
          const { data } = await api.get<ManagedUser>(
            `/api/v1/users/${encodeURIComponent(asUserId)}`,
          );
          return data;
        }
        throw err;
      }
    }

    async function load() {
      setLoading(true);
      setError(null);
      setProperties([]);
      setPropertiesTotal(0);
      try {
        const data = await loadManagedUser(username);
        if (cancelled) {
          return;
        }
        setUser(data);
        setPropertiesLoading(true);
        try {
          const propertiesResponse =
            await api.get<PaginatedUserRelatedProperties>(
              `/api/v1/users/${encodeURIComponent(data.user_id)}/properties`,
              { params: { skip: 0, limit: 100 } },
            );
          if (!cancelled) {
            setProperties(propertiesResponse.data.items);
            setPropertiesTotal(propertiesResponse.data.total);
          }
        } catch {
          if (!cancelled) {
            setProperties([]);
            setPropertiesTotal(0);
          }
        } finally {
          if (!cancelled) {
            setPropertiesLoading(false);
          }
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setError("User not found or you do not have access.");
        }
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
  }, [username]);

  async function setActiveStatus(nextActive: boolean) {
    if (!user || user.is_active === nextActive) {
      return;
    }

    if (
      !nextActive &&
      !window.confirm(
        `Deactivate ${user.full_name?.trim() || user.user_id}?\n\nThey will not be able to sign in until activated again.`,
      )
    ) {
      return;
    }

    setStatusBusy(true);
    try {
      const { data } = await api.patch<ManagedUser>(
        `/api/v1/users/${encodeURIComponent(user.user_id)}/active`,
        { is_active: nextActive },
      );
      setUser(data);
      toast.success(
        nextActive ? "User admitted to system" : "User deactivated",
      );
    } catch (err) {
      toast.error("Unable to update account status", {
        description:
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Please try again.",
      });
    } finally {
      setStatusBusy(false);
    }
  }

  async function setAccessLevel(accessLevel: string) {
    if (!user) {
      return;
    }
    if ((user.access_level || "").toUpperCase() === accessLevel.toUpperCase()) {
      return;
    }
    setLevelBusy(true);
    try {
      const { data } = await api.patch<ManagedUser>(
        `/api/v1/users/${encodeURIComponent(user.user_id)}/access-level`,
        { access_level: accessLevel },
      );
      setUser(data);
      toast.success("Access updated", {
        description: labelForAccessLevel(data.access_level),
      });
    } catch (err) {
      toast.error("Unable to update access", {
        description:
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Please try again.",
      });
    } finally {
      setLevelBusy(false);
    }
  }

  async function setNomination(submitForApproval: boolean) {
    if (!user) {
      return;
    }
    const level = (user.access_level || "").toUpperCase();
    if (level === "PUBLIC") {
      toast.message("Approved public users are managed by Super Admin.");
      return;
    }
    const nextLevel = submitForApproval ? "ELEVATED" : "STANDARD";
    if (
      submitForApproval &&
      !window.confirm(
        `Submit ${user.full_name?.trim() || user.user_id} for Super Admin approval?\n\nThis sets the account to Pending until Super Admin promotes them to Public.`,
      )
    ) {
      return;
    }
    await setAccessLevel(nextLevel);
  }

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8">
        <p className="text-sm text-text-muted">Loading user profile…</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4 p-3 sm:p-4 lg:p-6 xl:p-8">
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:text-link-hover"
        >
          <Icons.ArrowBack className="h-4 w-4" />
          Back to users
        </Link>
        <p role="alert" className="text-sm text-danger">
          {error ?? "User not found."}
        </p>
      </div>
    );
  }

  const level = (user.access_level || "").toUpperCase();
  const pending = isPendingAccessLevel(user.access_level);
  const selectValue = SYSTEM_END_USER_LEVELS.includes(
    level as (typeof SYSTEM_END_USER_LEVELS)[number],
  )
    ? level
    : level || "STANDARD";

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-3 sm:p-4 lg:p-6 xl:p-8">
      <Link
        href="/users"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-link hover:text-link-hover"
      >
        <Icons.ArrowBack className="h-4 w-4" />
        Back to users
      </Link>

      <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {user.full_name?.trim() || "Unnamed user"}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            @{user.username ?? username} · {user.user_id}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
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
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isSystem ? (
            <select
              value={selectValue}
              disabled={levelBusy}
              onChange={(event) => void setAccessLevel(event.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text-primary outline-none focus:border-primary"
            >
              {!SYSTEM_END_USER_LEVELS.includes(
                selectValue as (typeof SYSTEM_END_USER_LEVELS)[number],
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
          ) : null}
          {isRegistryOrCompany && level !== "PUBLIC" ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle px-3 py-2">
              <span className="text-xs font-medium text-text-secondary">
                {pending ? "Pending" : "Not submitted"}
              </span>
              <AccountStatusToggle
                checked={pending}
                busy={levelBusy}
                onToggle={(next) => void setNomination(next)}
              />
            </div>
          ) : null}
          {isSystem ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle px-3 py-2">
              <span className="text-xs font-medium text-text-secondary">
                {user.is_active ? "Active" : "Inactive"}
              </span>
              <AccountStatusToggle
                checked={user.is_active}
                busy={statusBusy}
                onToggle={(next) => void setActiveStatus(next)}
              />
            </div>
          ) : null}
        </div>
      </header>

      <ProfileSection title="User Information">
        <Field label="Full Name" value={user.full_name} />
        <Field label="Username" value={user.username} />
        <Field label="User ID" value={user.user_id} mono />
        <Field label="Email" value={user.email} />
        <Field label="Phone" value={user.phone_number} />
      </ProfileSection>

      <ProfileSection title="Account & Access">
        {isSystem ? (
          <Field
            label="Access Level"
            value={labelForAccessLevel(user.access_level)}
          />
        ) : (
          <Field
            label="Admission"
            value={
              level === "PUBLIC"
                ? "Approved"
                : pending
                  ? "Pending"
                  : "Not submitted"
            }
          />
        )}
        <Field
          label="Account Status"
          value={user.is_active ? "Active" : "Inactive"}
        />
        <Field
          label="MFA"
          value={user.mfa_enabled ? "Enabled" : "Disabled"}
        />
        <Field label="KYC Status" value={user.kyc_status} />
      </ProfileSection>

      <ProfileSection title="Verification">
        <Field
          label="NIC Hash"
          value={user.nic_hash}
          displayValue={shortenHash(user.nic_hash)}
          mono
          full
        />
      </ProfileSection>

      <ProfileSection title="Wallet">
        <Field
          label="Wallet Address"
          value={user.wallet_address}
          mono
          full
          className="sm:col-span-2"
        />
      </ProfileSection>

      <ProfileSection title="Account Activity">
        <Field label="Created" value={formatDateTime(user.created_at)} />
        <Field label="Last Login" value={formatDateTime(user.last_login)} />
      </ProfileSection>

      <section className="border-b border-border-subtle pb-5 last:border-b-0 last:pb-0">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-text-muted uppercase">
            Related Properties
          </h2>
          {!propertiesLoading ? (
            <span className="text-xs text-text-muted">
              {propertiesTotal} total
            </span>
          ) : null}
        </div>

        {propertiesLoading ? (
          <p className="mt-3 text-sm text-text-muted">Loading properties…</p>
        ) : properties.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            No properties linked to this user as owner, ownership history, or
            transaction party.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border-subtle rounded-xl border border-border-subtle">
            {properties.map((property) => {
              const title =
                property.property_name?.trim() ||
                property.title_deed_number?.trim() ||
                shortenId(property.property_id, 8, 6);
              const location = [property.address, property.district, property.city]
                .map((part) => part?.trim())
                .filter(Boolean)
                .join(", ");

              return (
                <li
                  key={property.property_id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      href={propertyHref(property.property_id)}
                      className="font-medium text-link hover:text-link-hover"
                    >
                      {title}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-text-muted">
                      {property.property_id}
                    </p>
                    {location ? (
                      <p className="mt-1 text-xs text-text-secondary">
                        {location}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {property.is_current_owner ? (
                        <StatusBadge
                          label="Current owner"
                          variant="success"
                          size="sm"
                        />
                      ) : null}
                      {property.in_ownership_history ? (
                        <StatusBadge
                          label="Ownership history"
                          variant="info"
                          size="sm"
                        />
                      ) : null}
                      {property.in_transactions ? (
                        <StatusBadge
                          label="Transaction party"
                          variant="neutral"
                          size="sm"
                        />
                      ) : null}
                      {property.party_roles.map((role) => (
                        <StatusBadge
                          key={role}
                          label={role}
                          variant="warning"
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-1 text-xs text-text-muted sm:items-end">
                    <span>{property.land_type?.trim() || "—"}</span>
                    <span>
                      {property.verification_status?.trim() ||
                        property.legal_status?.trim() ||
                        "—"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border-subtle pb-5 last:border-b-0 last:pb-0">
      <h2 className="text-xs font-semibold tracking-wider text-text-muted uppercase">
        {title}
      </h2>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  displayValue,
  mono,
  full,
  className,
}: {
  label: string;
  value: string | null | undefined;
  displayValue?: string | null;
  mono?: boolean;
  full?: boolean;
  className?: string;
}) {
  const shown = (displayValue ?? value)?.trim();
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium text-text-muted">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-text-primary ${
          mono ? "font-mono text-xs break-all" : ""
        } ${full && value?.trim() ? "select-all" : ""}`}
        title={value?.trim() || undefined}
      >
        {shown || "—"}
      </dd>
    </div>
  );
}
