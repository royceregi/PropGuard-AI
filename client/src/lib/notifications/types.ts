export interface NotificationItem {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string | null;
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  total: number;
  unread_count: number;
  skip: number;
  limit: number;
}

export interface NotificationStats {
  unread_count: number;
  total_count: number;
}

export type NotificationBadgeVariant =
  "success" | "info" | "warning" | "error" | "neutral";

interface NotificationTypeMeta {
  label: string;
  variant: NotificationBadgeVariant;
}

const TYPE_META: Record<string, NotificationTypeMeta> = {
  PROPERTY_SHARED: { label: "Property Shared", variant: "success" },
  SHARE_REVOKED: { label: "Share Revoked", variant: "warning" },
  RISK_REQUEST_CREATED: { label: "Risk Request", variant: "info" },
  RISK_REQUEST_COMPLETED: { label: "Risk Request", variant: "success" },
  ACCESS_LEVEL_CHANGED: { label: "Access Update", variant: "info" },
  BLOCKCHAIN_ALERT: { label: "Blockchain Alert", variant: "error" }
};

const DEFAULT_TYPE_META: NotificationTypeMeta = {
  label: "Notification",
  variant: "neutral"
};

export function notificationTypeMeta(
  type: string | null | undefined
): NotificationTypeMeta {
  const key = (type ?? "").trim().toUpperCase();
  return TYPE_META[key] ?? DEFAULT_TYPE_META;
}

export function formatRelativeTime(value: string | null | undefined): string {
  const date = parseTimestamp(value);
  if (!date) {
    return "";
  }
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return formatNotificationTimestamp(value);
}

export function formatNotificationTimestamp(
  value: string | null | undefined
): string {
  const date = parseTimestamp(value);
  if (!date) {
    return "—";
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } | null })
    ?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
    return String(detail[0].msg).replace(/^Value error, /, "");
  }
  return fallback;
}
