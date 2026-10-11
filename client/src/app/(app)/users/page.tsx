import type { Metadata } from "next";
import { Suspense } from "react";
import { UserManagementUI } from "@/components/users/UserManagementUI";

export const metadata: Metadata = {
  title: "User Management · PropGuard AI"
};

export default function UsersPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm text-text-muted">Loading users…</p>}
    >
      <UserManagementUI />
    </Suspense>
  );
}
