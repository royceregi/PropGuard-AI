"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isAxiosError } from "axios";
import { SearchTermChip } from "@/components/ui/SearchTermChip";
import { ForensicFilters } from "@/components/transactions/ForensicFilters";
import { InvestigationResults } from "@/components/transactions/InvestigationResults";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import { Icons } from "@/components/icons";
import { api } from "@/lib/api/client";
import {
  buildTransactionQueryParams,
  EMPTY_TRANSACTION_SEARCH_FILTERS,
  TRANSACTION_PAGE_SIZE,
  type PaginatedPropertyTransactions,
  type PropertyTransaction,
  type TransactionSearchFilters
} from "@/lib/transactions/types";

function visiblePages(current: number, totalPages: number): number[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.max(1, Math.min(current - 1, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export function TransactionSearchUI() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParam = useSearchParams().get("search")?.trim() ?? "";
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filters, setFilters] = useState<TransactionSearchFilters>({
    ...EMPTY_TRANSACTION_SEARCH_FILTERS,
    q: searchParam
  });
  const [syncedSearch, setSyncedSearch] = useState(searchParam);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<PropertyTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (searchParam !== syncedSearch) {
    setSyncedSearch(searchParam);
    setLoading(true);
    setPage(1);
    setFilters({ ...EMPTY_TRANSACTION_SEARCH_FILTERS, q: searchParam });
  }

  useEffect(() => {
    let cancelled = false;

    async function fetchTransactions() {
      try {
        const { data } = await api.get<PaginatedPropertyTransactions>(
          "/api/v1/property-transactions/",
          { params: buildTransactionQueryParams(filters, page) }
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
            : "Unable to load transactions."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchTransactions();
    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  function handleSubmit(nextFilters: TransactionSearchFilters) {
    setLoading(true);
    setError(null);
    setPage(1);
    setFilters(nextFilters);
  }

  function handleClear() {
    setLoading(true);
    setError(null);
    setPage(1);
    setFilters(EMPTY_TRANSACTION_SEARCH_FILTERS);
    if (searchParam) {
      router.replace(pathname, { scroll: false });
    }
  }

  function clearSearchTerm() {
    setLoading(true);
    setPage(1);
    setFilters((current) => ({ ...current, q: "" }));
    router.replace(pathname, { scroll: false });
  }

  function handlePageChange(nextPage: number) {
    setLoading(true);
    setError(null);
    setPage(nextPage);
  }

  const totalPages = Math.max(1, Math.ceil(total / TRANSACTION_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <ForensicFilters
        key={syncedSearch}
        initialValues={filters}
        loading={loading}
        onSubmit={handleSubmit}
        onClear={handleClear}
      />

      {filters.q ? (
        <SearchTermChip term={filters.q} onClear={clearSearchTerm} />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-text-primary md:text-lg">
          {loading
            ? "Loading results…"
            : `${total.toLocaleString()} Results Found`}
        </h2>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              view === "list"
                ? "bg-primary-subtle text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
            aria-label="List view"
            aria-pressed={view === "list"}
          >
            <Icons.ViewList className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setView("grid")}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              view === "grid"
                ? "bg-primary-subtle text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
          >
            <Icons.GridView className="h-5 w-5" />
          </button>
        </div>
      </div>

      {view === "list" ? (
        <InvestigationResults
          items={items}
          total={total}
          page={page}
          pageSize={TRANSACTION_PAGE_SIZE}
          loading={loading}
          error={error}
          onPageChange={handlePageChange}
        />
      ) : (
        <>
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-critical-container px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="py-10 text-center text-sm text-text-muted">
              Loading transactions…
            </p>
          ) : null}

          {!loading && !error && items.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-muted">
              No transactions matched these filters.
            </p>
          ) : null}

          {!loading && items.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6">
              {items.map((tx) => (
                <TransactionCard
                  key={tx.transaction_id}
                  transaction={tx}
                  layout="grid"
                />
              ))}
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-center">
            <nav
              className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1"
              aria-label="Pagination"
            >
              <button
                type="button"
                disabled={loading || page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className="flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-canvas hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>

              {visiblePages(page, totalPages).map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  disabled={loading}
                  aria-current={page === pageNumber ? "page" : undefined}
                  onClick={() => handlePageChange(pageNumber)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors disabled:opacity-60 ${
                    page === pageNumber
                      ? "bg-primary text-white"
                      : "text-text-secondary hover:bg-surface-canvas hover:text-text-primary"
                  }`}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                type="button"
                disabled={loading || page >= totalPages || total === 0}
                onClick={() => handlePageChange(page + 1)}
                className="flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-canvas hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
