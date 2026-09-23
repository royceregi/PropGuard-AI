"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountStatusToggle } from "@/components/users/AccountStatusToggle";
import { UserSummaryDrawer } from "@/components/users/UserSummaryDrawer";
import { useAuth } from "@/hooks/useAuth";
import { labelForAccessLevel } from "@/lib/auth/roles";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/toast";
import {
  isPendingAccessLevel,
  type ManagedUser,
} from "@/lib/users/types";

interface UsersTableProps {
  refreshKey?: number;
  onChanged?: () => void;
}

export function UsersTable({ refreshKey = 0, onChanged }: UsersTableProps) {
  const { user: currentUser } = useAuth();
  const isSystem = currentUser?.access_level === "SYSTEM";
  const isRegistryOrCompany =
    currentUser?.access_level === "REGISTRY" ||
    currentUser?.access_level === "COMPANY";
  const canActivate = isSystem || isRegistryOrCompany;

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [levelBusyId, setLevelBusyId] = useState<string | null>(null);
  const [prevRefreshKey, setPrevRefreshKey] = useState(refreshKey);

  if (refreshKey !== prevRefreshKey) {
    setPrevRefreshKey(refreshKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      try {
        const { data } = await api.get<ManagedUser[]>("/api/v1/users/");
        if (cancelled) {
          return;
        }
        setUsers(data);
        setError(null);
      } catch {
        if (cancelled) {
          return;
        }
        setError("Unable to load users from the directory.");
        setUsers([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const selectedUser =
    users.find((item) => item.user_id === selectedId) ?? null;
  const previewOpen = Boolean(selectedUser);
  const columnCount = previewOpen ? 4 : 5;

  function openUser(userId: string) {
    setSelectedId(userId);
  }

  function onRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    userId: string,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openUser(userId);
    }
  }

  function applyUserUpdate(updated: ManagedUser) {
    setUsers((current) =>
      current.map((item) =>
        item.user_id === updated.user_id ? updated : item,
      ),
    );
    onChanged?.();
  }

  async function setActiveStatus(user: ManagedUser, nextActive: boolean) {
    if (user.is_active === nextActive) {
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

    setStatusBusyId(user.user_id);
    try {
      const { data } = await api.patch<ManagedUser>(
        `/api/v1/users/${encodeURIComponent(user.user_id)}/active`,
        { is_active: nextActive },
      );
      applyUserUpdate(data);
      toast.success(
        nextActive ? "User admitted to system" : "User deactivated",
        {
          description: `${data.full_name?.trim() || data.user_id} is now ${
            nextActive ? "Active" : "Inactive"
          }.`,
        },
      );
    } catch (err) {
      toast.error("Unable to update account status", {
        description:
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Please try again.",
      });
    } finally {
      setStatusBusyId(null);
    }
  }

  async function setAccessLevel(user: ManagedUser, accessLevel: string) {
    if ((user.access_level || "").toUpperCase() === accessLevel.toUpperCase()) {
      return;
    }
    setLevelBusyId(user.user_id);
    try {
      const { data } = await api.patch<ManagedUser>(
        `/api/v1/users/${encodeURIComponent(user.user_id)}/access-level`,
        { access_level: accessLevel },
      );
      applyUserUpdate(data);
      toast.success("Access updated", {
        description: `${data.full_name?.trim() || data.user_id} → ${labelForAccessLevel(data.access_level)}`,
      });
    } catch (err) {
      toast.error("Unable to update access", {
        description:
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Please try again.",
      });
    } finally {
      setLevelBusyId(null);
    }
  }

  async function setNomination(user: ManagedUser, submitForApproval: boolean) {
    const level = (user.access_level || "").toUpperCase();
    if (level === "PUBLIC") {
      toast.message("Approved public users are managed by Super Admin.");
      return;
    }
    const nextLevel = submitForApproval ? "ELEVATED" : "STANDARD";
    if (level === nextLevel) {
      return;
    }
    if (
      submitForApproval &&
      !window.confirm(
        `Submit ${user.full_name?.trim() || user.user_id} for Super Admin approval?\n\nThis sets the account to Pending until Super Admin promotes them to Public.`,
      )
    ) {
      return;
    }
    await setAccessLevel(user, nextLevel);
  }

  return (
    <div
      className={`grid gap-4 ${
        previewOpen
          ? "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] lg:items-start"
          : ""
      }`}
    >
      <section
        aria-label="Users directory"
        className="min-w-0 overflow-hidden rounded-xl border border-border-subtle bg-surface"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">User ID</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">
                  {isRegistryOrCompany ? "Submit for approval" : "Account Status"}
                </th>
                {!previewOpen ? (
                  <th className="px-4 py-3 font-semibold">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-10 text-center text-sm text-text-muted"
                  >
                    Loading users…
                  </td>
                </tr>
              ) : null}

              {!loading && error ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-10 text-center text-sm text-danger"
                  >
                    {error}
                  </td>
                </tr>
              ) : null}

              {!loading && !error && users.length === 0 ? (
                <tr>
                  <td
                    colSpan={columnCount}
                    className="px-4 py-10 text-center text-sm text-text-muted"
                  >
                    No users found in the directory.
                  </td>
                </tr>
              ) : null}

              {users.map((user) => {
                const username = user.username?.trim();
                const selected = selectedId === user.user_id;
                const statusBusy = statusBusyId === user.user_id;
                const levelBusy = levelBusyId === user.user_id;
                const pending = isPendingAccessLevel(user.access_level);

                return (
                  <tr
                    key={user.user_id}
                    tabIndex={0}
                    aria-selected={selected}
                    onClick={() => openUser(user.user_id)}
                    onKeyDown={(event) => onRowKeyDown(event, user.user_id)}
                    className={`cursor-pointer border-t border-border-subtle transition-colors hover:bg-surface-subtle/80 focus-visible:bg-surface-subtle/80 focus-visible:outline-none ${
                      selected ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="block truncate font-medium text-text-primary">
                        {user.full_name?.trim() || "Unnamed user"}
                      </span>
                      <span className="block truncate text-xs text-text-muted">
                        {username ? `@${username}` : "No username"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {user.user_id}
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-text-secondary">
                      {user.email?.trim() || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {isRegistryOrCompany ? (
                        <div className="flex items-center gap-2.5">
                          <StatusBadge
                            label={
                              (user.access_level || "").toUpperCase() === "PUBLIC"
                                ? "Approved"
                                : pending
                                  ? "Pending"
                                  : "Not submitted"
                            }
                            variant={
                              (user.access_level || "").toUpperCase() === "PUBLIC"
                                ? "success"
                                : pending
                                  ? "warning"
                                  : "neutral"
                            }
                            size="sm"
                          />
                          {(user.access_level || "").toUpperCase() === "PUBLIC" ? null : (
                            <AccountStatusToggle
                              checked={pending}
                              busy={levelBusy}
                              onToggle={(submit) =>
                                void setNomination(user, submit)
                              }
                            />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5">
                          <StatusBadge
                            label={user.is_active ? "Active" : "Inactive"}
                            variant={user.is_active ? "success" : "warning"}
                            size="sm"
                          />
                          {canActivate ? (
                            <AccountStatusToggle
                              checked={user.is_active}
                              busy={statusBusy}
                              onToggle={(next) =>
                                void setActiveStatus(user, next)
                              }
                            />
                          ) : null}
                        </div>
                      )}
                    </td>
                    {!previewOpen ? (
                      <td className="px-4 py-3">
                        {username ? (
                          <Link
                            href={`/users/${encodeURIComponent(username)}`}
                            aria-label={`View profile for ${user.full_name ?? username}`}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-link transition-colors hover:bg-primary-subtle hover:text-link-hover"
                          >
                            <Icons.Visibility className="h-3.5 w-3.5" />
                            View
                          </Link>
                        ) : (
                          <button
                            type="button"
                            aria-label={`View summary for ${user.full_name ?? user.user_id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openUser(user.user_id);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-link transition-colors hover:bg-primary-subtle hover:text-link-hover"
                          >
                            <Icons.Visibility className="h-3.5 w-3.5" />
                            View
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {previewOpen ? (
        <div className="lg:sticky lg:top-20 lg:self-start">
          <UserSummaryDrawer
            user={selectedUser}
            open={previewOpen}
            isSystem={isSystem}
            canManageStatus={isSystem}
            canTogglePending={isRegistryOrCompany}
            canSetAccessLevel={isSystem}
            statusBusy={
              selectedUser ? statusBusyId === selectedUser.user_id : false
            }
            levelBusy={
              selectedUser ? levelBusyId === selectedUser.user_id : false
            }
            onClose={() => setSelectedId(null)}
            onToggleActive={(next) => {
              if (selectedUser) {
                void setActiveStatus(selectedUser, next);
              }
            }}
            onToggleRegular={(submitForApproval) => {
              if (selectedUser) {
                void setNomination(selectedUser, submitForApproval);
              }
            }}
            onAccessLevelChange={(level) => {
              if (selectedUser) {
                void setAccessLevel(selectedUser, level);
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
