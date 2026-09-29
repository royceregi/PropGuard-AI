import { Suspense } from "react";
import type { Metadata } from "next";
import { ProfileUI } from "@/components/profile/ProfileUI";

export const metadata: Metadata = {
  title: "Profile · PropGuard AI"
};

export default function ProfilePage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm text-text-muted">Loading profile…</p>}
    >
      <ProfileUI />
    </Suspense>
  );
}
