"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/notifications/types";
import type {
  NotificationItem,
  PaginatedNotifications
} from "@/lib/notifications/types";

export interface NotificationsQuery {
  skip: number;
  limit: number;
  unreadOnly: boolean;
}

interface UseNotificationsOptions {
  query: NotificationsQuery;
  /** Polling interval in ms; 0 disables polling. */
  pollMs?: number;
  /** Set false while the signed-in user is unknown to skip fetching. */
  enabled?: boolean;
}

function loadNotifications(
  query: NotificationsQuery
): Promise<PaginatedNotifications> {
  return api
    .get<PaginatedNotifications>("/api/v1/notifications/", {
      params: {
        skip: query.skip,
        limit: query.limit,
        unread_only: query.unreadOnly
      }
    })
    .then(({ data }) => data);
}

export function useNotifications({
  query,
  pollMs = 0,
  enabled = true
}: UseNotificationsOptions) {
  const { skip, limit, unreadOnly } = query;
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    loadNotifications({ skip, limit, unreadOnly })
      .then((data) => {
        if (cancelled) {
          return;
        }
        setItems(data.items);
        setTotal(data.total);
        setUnreadCount(data.unread_count);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(apiErrorMessage(err, "Unable to load notifications."));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, skip, limit, unreadOnly]);

  const refresh = useCallback(async () => {
    try {
      const data = await loadNotifications({ skip, limit, unreadOnly });
      setItems(data.items);
      setTotal(data.total);
      setUnreadCount(data.unread_count);
      setError(null);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Unable to load notifications."));
    } finally {
      setLoading(false);
    }
  }, [skip, limit, unreadOnly]);

  useEffect(() => {
    if (!enabled || pollMs <= 0) {
      return;
    }
    const interval = window.setInterval(() => {
      void refresh();
    }, pollMs);
    return () => window.clearInterval(interval);
  }, [enabled, pollMs, refresh]);

  const markAsRead = useCallback(
    async (item: NotificationItem): Promise<boolean> => {
      if (item.is_read) {
        return true;
      }
      try {
        await api.patch(
          `/api/v1/notifications/${encodeURIComponent(item.notification_id)}/read`
        );
      } catch {
        return false;
      }
      setItems((current) =>
        current.map((entry) =>
          entry.notification_id === item.notification_id
            ? { ...entry, is_read: true }
            : entry
        )
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      return true;
    },
    []
  );

  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    try {
      await api.patch("/api/v1/notifications/read-all");
    } catch {
      return false;
    }
    setItems((current) =>
      current.map((entry) => ({ ...entry, is_read: true }))
    );
    setUnreadCount(0);
    return true;
  }, []);

  const removeNotification = useCallback(
    async (item: NotificationItem): Promise<boolean> => {
      try {
        await api.delete(
          `/api/v1/notifications/${encodeURIComponent(item.notification_id)}`
        );
      } catch {
        return false;
      }
      setItems((current) =>
        current.filter(
          (entry) => entry.notification_id !== item.notification_id
        )
      );
      setTotal((count) => Math.max(0, count - 1));
      if (!item.is_read) {
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      return true;
    },
    []
  );

  return {
    items,
    total,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    removeNotification
  };
}
