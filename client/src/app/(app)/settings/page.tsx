import type { Metadata } from "next";
import { SettingsUI } from "@/components/settings/SettingsUI";

export const metadata: Metadata = {
  title: "Settings · PropGuard AI"
};

export default function SettingsPage() {
  return (
    <div className="bg-background">
      <SettingsUI />
    </div>
  );
}
