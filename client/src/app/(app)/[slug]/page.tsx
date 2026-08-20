import { notFound } from "next/navigation";
import { getNavItemBySlug } from "@/components/layout/nav";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!getNavItemBySlug(slug)) {
    notFound();
  }

  return null;
}
