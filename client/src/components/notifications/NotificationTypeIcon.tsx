import { Icons } from "@/components/icons";

type IconComponent = (typeof Icons)[keyof typeof Icons];

interface TypeStyle {
  icon: IconComponent;
  /** Wrapper classes: container bg + icon color. */
  className: string;
}

const TYPE_STYLES: Record<string, TypeStyle> = {
  PROPERTY_SHARED: {
    icon: Icons.Group,
    className: "bg-success-container text-success"
  },
  SHARE_REVOKED: {
    icon: Icons.PersonRemove,
    className: "bg-accent-container text-accent"
  },
  RISK_REQUEST_CREATED: {
    icon: Icons.GppMaybe,
    className: "bg-primary-subtle text-primary"
  },
  RISK_REQUEST_COMPLETED: {
    icon: Icons.GppGood,
    className: "bg-success-container text-success"
  },
  ACCESS_LEVEL_CHANGED: {
    icon: Icons.ManageAccounts,
    className: "bg-primary-subtle text-primary"
  },
  BLOCKCHAIN_ALERT: {
    icon: Icons.WarningAmber,
    className: "bg-critical-container text-danger"
  }
};

const DEFAULT_STYLE: TypeStyle = {
  icon: Icons.Notifications,
  className: "bg-surface-subtle text-text-secondary"
};

export function NotificationTypeIcon({ type }: { type: string }) {
  const style = TYPE_STYLES[type.trim().toUpperCase()] ?? DEFAULT_STYLE;
  const Icon = style.icon;
  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${style.className}`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}
