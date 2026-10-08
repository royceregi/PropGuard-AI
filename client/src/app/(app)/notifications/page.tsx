import type { Metadata } from "next";
import { NotificationsUI } from "@/components/notifications/NotificationsUI";

export const metadata: Metadata = {
  title: "Notifications · PropGuard AI"
};

export default function NotificationsPage() {
  return <NotificationsUI />;
}
