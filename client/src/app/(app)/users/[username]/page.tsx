import type { Metadata } from "next";
import { UserDetailsView } from "@/components/users/UserDetailsView";

export const metadata: Metadata = {
  title: "User details · PropGuard AI",
};

export default async function UserDetailsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  return <UserDetailsView username={decodeURIComponent(username)} />;
}
