import type { Metadata } from "next";
import { PropertySearchUI } from "@/components/property-search/PropertySearchUI";

export const metadata: Metadata = {
  title: "Property Search · PropGuard AI"
};

export default function PropertySearchPage() {
  return <PropertySearchUI />;
}
