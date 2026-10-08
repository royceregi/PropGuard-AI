"use client";

import { useState } from "react";
import { Icons } from "@/components/icons";
import { NotificationTypeIcon } from "@/components/notifications/NotificationTypeIcon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useNotifications } from "@/hooks/useNotifications";
import {
  formatNotificationTimestamp,
  notificationTypeMeta
} from "@/lib/notifications/types";
import type { NotificationItem } from "@/lib/notifications/types";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 20;

type NotificationFilter = "all" | "unread";

export function NotificationsUI() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);

  const {
    items,
    total,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    removeNotification
  } = useNotifications({
    query: {
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
      unreadOnly: filter === "unread"
    }
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  function switchFilter(next: NotificationFilter) {
    setFilter(next);
    setPage(1);
  }

  async function handleMarkAllRead() {
    const ok = await markAllAsRead();
    if (!ok) {
      toast.error("Unable to mark notifications as read.");
    }
  }

  async function handleMarkRead(item: NotificationItem) {
    const ok = await markAsRead(item);
    if (!ok) {
      toast.error("Unable to mark notification as read.");
    }
  }

  async function handleDelete(item: NotificationItem) {
    const ok = await removeNotification(item);
    if (!ok) {
      toast.error("Unable to delete notification.");
      return;
    }
    if (items.length === 1 && page > 1) {
      setPage(page - 1);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 sm:p-6">
      <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <Icons.Notifications className="h-5 w-5 text-text-muted" />
            <h2 className="text-lg font-bold text-text-primary">
              Notifications
            </h2>
            {unreadCount > 0 ? (
              <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-xs font-medium text-primary">
                {unreadCount} unread
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Filter notifications"
              className="flex rounded-lg border border-border-subtle p-0.5"
            >
              <FilterButton
                label="All"
                active={filter === "all"}
                onClick={() => switchFilter("all")}
              />
              <FilterButton
                label="Unread"
                active={filter === "unread"}
                onClick={() => switchFilter("unread")}
              />
            </div>
            <button
              type="button"
              title="Refresh"
              aria-label="Refresh notifications"
              onClick={() => void refresh()}
              className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
            >
              <Icons.Sync className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={() => void handleMarkAllRead()}
              disabled={unreadCount === 0}
              className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Icons.MarkEmailRead className="h-4 w-4" />
              Mark all read
            </button>
          </div>
        </header>

        {loading && items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-text-muted">
            Loading notifications…
          </p>
        ) : error ? (
          <p
            role="alert"
            className="px-5 py-12 text-center text-sm text-danger"
          >
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Icons.CheckCircle className="h-10 w-10 text-success" />
            <p className="text-sm font-medium text-text-primary">
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </p>
            <p className="text-xs text-text-muted">
              Alerts about property shares, risk requests and account changes
              will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {items.map((item) => (
              <NotificationRow
                key={item.notification_id}
                item={item}
                onMarkRead={() => void handleMarkRead(item)}
                onDelete={() => void handleDelete(item)}
              />
            ))}
          </ul>
        )}

        {total > 0 ? (
          <footer className="flex items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
            <p className="text-xs text-text-muted">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous page"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icons.ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="text-xs text-text-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                aria-label="Next page"
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <Icons.ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-primary text-text-inverse"
          : "text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
      }`}
    >
      {label}
    </button>
  );
}

function NotificationRow({
  item,
  onMarkRead,
  onDelete
}: {
  item: NotificationItem;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  const meta = notificationTypeMeta(item.type);
  return (
    <li
      className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:gap-4 ${
        item.is_read ? "" : "bg-primary-subtle/40"
      }`}
    >
      <NotificationTypeIcon type={item.type} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`text-sm text-text-primary ${
              item.is_read ? "font-medium" : "font-semibold"
            }`}
          >
            {item.title}
          </p>
          <StatusBadge label={meta.label} variant={meta.variant} size="sm" />
          {!item.is_read ? (
            <span
              className="h-2 w-2 rounded-full bg-primary"
              aria-label="Unread"
            />
          ) : null}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">
          {item.message}
        </p>
        <p className="mt-1.5 text-[11px] text-text-muted">
          {formatNotificationTimestamp(item.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!item.is_read ? (
          <button
            type="button"
            title="Mark as read"
            aria-label="Mark as read"
            onClick={onMarkRead}
            className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            <Icons.Check className="h-4 w-4" />
          </button>
        ) : null}
        <button
          type="button"
          title="Delete notification"
          aria-label="Delete notification"
          onClick={onDelete}
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-critical-container hover:text-danger"
        >
          <Icons.Delete className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
