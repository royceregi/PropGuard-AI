"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import ArrowDownward from "@mui/icons-material/ArrowDownward";
import ArrowUpward from "@mui/icons-material/ArrowUpward";
import UnfoldMore from "@mui/icons-material/UnfoldMore";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountStatusToggle } from "@/components/users/AccountStatusToggle";
import { UserSummaryDrawer } from "@/components/users/UserSummaryDrawer";
import { useAuth } from "@/hooks/useAuth";
import { labelForAccessLevel } from "@/lib/auth/roles";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/toast";
import { isPendingAccessLevel, type ManagedUser } from "@/lib/users/types";

interface UsersTableProps {
  refreshKey?: number;
  onChanged?: () => void;
}

type SortField =
  | "full_name"
  | "user_id"
  | "email"
  | "access_level"
  | "is_active"
  | "created_at"
  | "last_login";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "created_at", label: "Date joined" },
  { value: "last_login", label: "Last login" },
  { value: "full_name", label: "Name" },
  { value: "user_id", label: "User ID" },
  { value: "email", label: "Email" },
  { value: "access_level", label: "Access level" },
  { value: "is_active", label: "Account status" }
];

const DEFAULT_DIR: Record<SortField, SortDir> = {
  full_name: "asc",
  user_id: "asc",
  email: "asc",
  access_level: "asc",
  is_active: "desc",
  created_at: "desc",
  last_login: "desc"
};

function SortableHeader({
  label,
  field,
  sortBy,
  sortDir,
  onSort
}: {
  label: string;
  field: SortField;
  sortBy: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const active = sortBy === field;
  const Icon = !active
    ? UnfoldMore
    : sortDir === "asc"
      ? ArrowUpward
      : ArrowDownward;
  return (
    <th
      className="px-4 py-3 font-semibold"
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-text-primary ${
          active ? "text-text-primary" : ""
        }`}
      >
        {label}
        <Icon className={`!h-3.5 !w-3.5 ${active ? "" : "opacity-50"}`} />
      </button>
    </th>
  );
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  if (refreshKey !== prevRefreshKey) {
    setPrevRefreshKey(refreshKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  function changeSort(field: SortField) {
    if (field === sortBy) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(DEFAULT_DIR[field]);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchUsers() {
      try {
        const params: Record<string, string | number> = { limit: 500 };
        if (isSystem) {
          params.sort_by = sortBy;
          params.sort_dir = sortDir;
          if (search) {
            params.q = search;
          }
        }
        const { data } = await api.get<ManagedUser[]>("/api/v1/users/", {
          params
        });
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
  }, [refreshKey, isSystem, search, sortBy, sortDir]);

  const selectedUser =
    users.find((item) => item.user_id === selectedId) ?? null;
  const previewOpen = Boolean(selectedUser);
  const columnCount = previewOpen ? 4 : 5;

  function openUser(userId: string) {
    setSelectedId(userId);
  }

  function onRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    userId: string
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openUser(userId);
    }
  }

  function applyUserUpdate(updated: ManagedUser) {
    setUsers((current) =>
      current.map((item) => (item.user_id === updated.user_id ? updated : item))
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
        `Deactivate ${user.full_name?.trim() || user.user_id}?\n\nThey will not be able to sign in until activated again.`
      )
    ) {
      return;
    }

    setStatusBusyId(user.user_id);
    try {
      const { data } = await api.patch<ManagedUser>(
        `/api/v1/users/${encodeURIComponent(user.user_id)}/active`,
        { is_active: nextActive }
      );
      applyUserUpdate(data);
      toast.success(
        nextActive ? "User admitted to system" : "User deactivated",
        {
          description: `${data.full_name?.trim() || data.user_id} is now ${
            nextActive ? "Active" : "Inactive"
          }.`
        }
      );
    } catch (err) {
      toast.error("Unable to update account status", {
        description:
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Please try again."
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
        { access_level: accessLevel }
      );
      applyUserUpdate(data);
      toast.success("Access updated", {
        description: `${data.full_name?.trim() || data.user_id} → ${labelForAccessLevel(data.access_level)}`
      });
    } catch (err) {
      toast.error("Unable to update access", {
        description:
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Please try again."
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
        `Submit ${user.full_name?.trim() || user.user_id} for Super Admin approval?\n\nThis sets the account to Pending until Super Admin promotes them to Public.`
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
        {isSystem ? (
          <div className="flex flex-col gap-3 border-b border-border-subtle p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="relative w-full sm:max-w-sm">
              <Icons.Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name, username, ID, email or phone"
                aria-label="Search users"
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface py-2 pr-9 pl-9 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-text-muted hover:text-text-primary"
                >
                  <Icons.Close className="!h-4 !w-4" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="users-sort"
                className="text-xs font-semibold text-text-muted"
              >
                Sort by
              </label>
              <select
                id="users-sort"
                value={sortBy}
                onChange={(event) => {
                  const field = event.target.value as SortField;
                  setSortBy(field);
                  setSortDir(DEFAULT_DIR[field]);
                }}
                className="h-10 rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary outline-none focus:border-primary"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  setSortDir((dir) => (dir === "asc" ? "desc" : "asc"))
                }
                aria-label={
                  sortDir === "asc" ? "Sort descending" : "Sort ascending"
                }
                title={sortDir === "asc" ? "Ascending" : "Descending"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-subtle bg-surface text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
              >
                {sortDir === "asc" ? (
                  <ArrowUpward className="!h-4 !w-4" />
                ) : (
                  <ArrowDownward className="!h-4 !w-4" />
                )}
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
              <tr>
                {isSystem ? (
                  <>
                    <SortableHeader
                      label="User"
                      field="full_name"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={changeSort}
                    />
                    <SortableHeader
                      label="User ID"
                      field="user_id"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={changeSort}
                    />
                    <SortableHeader
                      label="Email"
                      field="email"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={changeSort}
                    />
                    <SortableHeader
                      label="Account Status"
                      field="is_active"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={changeSort}
                    />
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">User ID</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">
                      {isRegistryOrCompany
                        ? "Submit for approval"
                        : "Account Status"}
                    </th>
                  </>
                )}
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
                    {isSystem && search
                      ? `No users match "${search}".`
                      : "No users found in the directory."}
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
                      selected
                        ? "bg-primary/5 ring-1 ring-inset ring-primary/20"
                        : ""
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
                              (user.access_level || "").toUpperCase() ===
                              "PUBLIC"
                                ? "Approved"
                                : pending
                                  ? "Pending"
                                  : "Not submitted"
                            }
                            variant={
                              (user.access_level || "").toUpperCase() ===
                              "PUBLIC"
                                ? "success"
                                : pending
                                  ? "warning"
                                  : "neutral"
                            }
                            size="sm"
                          />
                          {(user.access_level || "").toUpperCase() ===
                          "PUBLIC" ? null : (
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
