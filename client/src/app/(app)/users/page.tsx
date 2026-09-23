import type { Metadata } from "next";
import { UserManagementUI } from "@/components/users/UserManagementUI";

export const metadata: Metadata = {
  title: "User Management · PropGuard AI",
};

export default function UsersPage() {
  return <UserManagementUI />;
}
