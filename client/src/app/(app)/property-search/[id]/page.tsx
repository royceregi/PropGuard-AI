import type { Metadata } from "next";
import { PropertyDetailsUI } from "@/components/property-search/PropertyDetailsUI";

export const metadata: Metadata = {
  title: "Property Details · PropGuard AI"
};

export default async function PropertyDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8">
      <PropertyDetailsUI propertyId={decodeURIComponent(id)} />
    </div>
  );
}
