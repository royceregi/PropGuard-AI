"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import { NotificationTypeIcon } from "@/components/notifications/NotificationTypeIcon";
import { useNotifications } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/notifications/types";
import type { NotificationItem } from "@/lib/notifications/types";
import { toast } from "@/lib/toast";

const RECENT_LIMIT = 8;
const POLL_MS = 30_000;

export function NotificationsPopover() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    items,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    removeNotification
  } = useNotifications({
    query: { skip: 0, limit: RECENT_LIMIT, unreadOnly: false },
    pollMs: POLL_MS
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      void refresh();
    }
  }, [open, refresh]);

  function handleOpenNotification(item: NotificationItem) {
    if (!item.is_read) {
      void markAsRead(item);
    }
    setOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  }

  async function handleMarkAllRead() {
    const ok = await markAllAsRead();
    if (!ok) {
      toast.error("Unable to mark notifications as read.");
    }
  }

  async function handleDelete(item: NotificationItem) {
    const ok = await removeNotification(item);
    if (!ok) {
      toast.error("Unable to delete notification.");
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative p-1 text-text-muted transition-colors hover:text-text-primary"
      >
        <Icons.Notifications className="h-6 w-6 text-[24px]" />
        {unreadCount > 0 ? (
          <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white ring-2 ring-surface">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-lg sm:w-96"
        >
          <PopoverHeader
            unreadCount={unreadCount}
            onMarkAllRead={() => void handleMarkAllRead()}
            onClose={() => setOpen(false)}
          />

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">
                Loading notifications…
              </p>
            ) : error ? (
              <p
                role="alert"
                className="px-4 py-8 text-center text-sm text-danger"
              >
                {error}
              </p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Icons.CheckCircle className="h-8 w-8 text-success" />
                <p className="text-sm font-medium text-text-primary">
                  You&apos;re all caught up
                </p>
                <p className="text-xs text-text-muted">
                  New alerts will appear here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {items.map((item) => (
                  <NotificationRow
                    key={item.notification_id}
                    item={item}
                    onOpen={() => handleOpenNotification(item)}
                    onMarkRead={() => void markAsRead(item)}
                    onDelete={() => void handleDelete(item)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border-subtle px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
              className="text-xs font-semibold text-link transition-colors hover:text-link-hover"
            >
              View all notifications
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PopoverHeader({
  unreadCount,
  onMarkAllRead,
  onClose
}: {
  unreadCount: number;
  onMarkAllRead: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-text-primary">
          Notifications
        </h2>
        {unreadCount > 0 ? (
          <span className="rounded-full bg-primary-subtle px-2 py-0.5 text-[11px] font-medium text-primary">
            {unreadCount} unread
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          title="Mark all as read"
          aria-label="Mark all as read"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icons.MarkEmailRead className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          title="Close notifications"
          aria-label="Close notifications"
          onClick={onClose}
          className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
        >
          <Icons.Close className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  onOpen,
  onMarkRead,
  onDelete
}: {
  item: NotificationItem;
  onOpen: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`group flex gap-2 px-4 py-3 transition-colors ${
        item.is_read
          ? "hover:bg-surface-subtle"
          : "bg-primary-subtle/40 hover:bg-primary-subtle/70"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <NotificationTypeIcon type={item.type} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-sm text-text-primary ${
                item.is_read ? "font-medium" : "font-semibold"
              }`}
            >
              {item.title}
            </span>
            <span className="shrink-0 text-[11px] text-text-muted">
              {formatRelativeTime(item.created_at)}
            </span>
          </span>
          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-text-secondary">
            {item.message}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col gap-1 self-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {!item.is_read ? (
          <button
            type="button"
            title="Mark as read"
            aria-label="Mark as read"
            onClick={onMarkRead}
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
          >
            <Icons.Check className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          title="Delete notification"
          aria-label="Delete notification"
          onClick={onDelete}
          className="rounded-lg p-1 text-text-muted transition-colors hover:bg-critical-container hover:text-danger"
        >
          <Icons.Delete className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
