import { redirect } from "next/navigation";

export default async function PropertyRedirectPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/property-search/${encodeURIComponent(id)}`);
}
