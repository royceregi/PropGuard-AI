"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { PropertyFilters } from "@/components/property-search/PropertyFilters";
import { PropertyResults } from "@/components/property-search/PropertyResults";
import { RetrievalUI } from "@/components/retrieval/RetrievalUI";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api/client";
import {
  buildPropertyQueryParams,
  EMPTY_PROPERTY_SEARCH_FILTERS,
  PROPERTY_PAGE_SIZE,
  type PaginatedProperties,
  type PropertyRecord,
  type PropertySearchFilters
} from "@/lib/property-search/types";

type Tab = "properties" | "retrieval";

export function PropertySearchUI() {
  const { user } = useAuth();
  const isPublicUser = user?.access_level === "PUBLIC";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const linkedQueryId = searchParams.get("qid")?.trim() || null;
  const linkedQuery = searchParams.get("q")?.trim() || null;
  const tabParam: Tab =
    searchParams.get("tab") === "retrieval" || linkedQueryId || linkedQuery
      ? "retrieval"
      : "properties";
  const [activeTab, setActiveTab] = useState<Tab>(tabParam);
  const [syncedTabParam, setSyncedTabParam] = useState<Tab>(tabParam);
  if (tabParam !== syncedTabParam) {
    setSyncedTabParam(tabParam);
    setActiveTab(tabParam);
  }
  const searchParam = searchParams.get("search")?.trim() ?? "";
  const [filters, setFilters] = useState<PropertySearchFilters>({
    ...EMPTY_PROPERTY_SEARCH_FILTERS,
    q: searchParam
  });
  const [syncedSearch, setSyncedSearch] = useState(searchParam);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PropertyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (searchParam !== syncedSearch) {
    setSyncedSearch(searchParam);
    setLoading(true);
    setPage(1);
    setFilters({ ...EMPTY_PROPERTY_SEARCH_FILTERS, q: searchParam });
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchProperties() {
      try {
        const { data } = await api.get<PaginatedProperties>(
          "/api/v1/properties/",
          { params: buildPropertyQueryParams(filters, page) }
        );
        if (cancelled) {
          return;
        }
        setItems(data.items);
        setTotal(data.total);
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setItems([]);
        setTotal(0);
        setError(
          isAxiosError(err) && typeof err.response?.data?.detail === "string"
            ? err.response.data.detail
            : "Unable to load properties."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (activeTab === "properties") {
      void fetchProperties();
    }
    return () => {
      cancelled = true;
    };
  }, [filters, page, activeTab]);

  function handleSubmit(nextFilters: PropertySearchFilters) {
    setLoading(true);
    setError(null);
    setPage(1);
    setFilters(nextFilters);
  }

  function handleClear() {
    setLoading(true);
    setError(null);
    setPage(1);
    setFilters(EMPTY_PROPERTY_SEARCH_FILTERS);
    if (searchParam) {
      router.replace(pathname, { scroll: false });
    }
  }

  function handlePageChange(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  return (
    <div className="mx-auto flex w-full max-w-full flex-col gap-4 p-3 sm:p-4 lg:p-6 xl:p-8">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            { id: "properties" as Tab, label: "Property Filters" },
            { id: "retrieval" as Tab, label: "Evidence Retrieval" }
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setActiveTab(id);
              if (id === "properties" && searchParams.toString()) {
                router.replace(pathname, { scroll: false });
              }
            }}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === id
                ? "border-b-2 border-primary text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "properties" && (
        <>
          {isPublicUser ? (
            <p className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
              Showing only properties you own or that were shared with you on a
              transaction. Unrelated properties are not available.
            </p>
          ) : null}
          <PropertyFilters
            key={syncedSearch}
            initialValues={filters}
            loading={loading}
            onSubmit={handleSubmit}
            onClear={handleClear}
          />
          <PropertyResults
            items={items}
            total={total}
            page={page}
            pageSize={PROPERTY_PAGE_SIZE}
            loading={loading}
            error={error}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {activeTab === "retrieval" && (
        <RetrievalUI
          key={linkedQueryId ?? linkedQuery ?? "new"}
          linkedQueryId={linkedQueryId}
          initialQuery={linkedQuery}
        />
      )}
    </div>
  );
}
