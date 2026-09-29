"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { isAxiosError } from "axios";
import { Icons } from "@/components/icons";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import {
  failedHashChecks,
  shortenHash,
  type PaginatedHashDetails
} from "@/lib/blockchain/verification";

const PAGE_SIZE = 25;

export function BlockchainHashDetailsTable() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PaginatedHashDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<PaginatedHashDetails>("/api/v1/blockchain/hash-details", {
        params: {
          skip: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          q: query || undefined
        }
      })
      .then(({ data: result }) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            isAxiosError(err) && typeof err.response?.data?.detail === "string"
              ? err.response.data.detail
              : "Unable to load ledger hash details."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, query]);

  function goToPage(next: number) {
    setLoading(true);
    setPage(next);
  }

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = draft.trim();
    if (next === query && page === 0) {
      return;
    }
    setLoading(true);
    setPage(0);
    setQuery(next);
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const invalidOnPage = items.filter((row) => row.integrity !== "VALID").length;

  return (
    <section
      aria-labelledby="blockchain-hash-details-title"
      className="overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
    >
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2
            id="blockchain-hash-details-title"
            className="text-base font-semibold text-text-primary"
          >
            Ledger Hash Details
          </h2>
          <p className="text-sm text-text-secondary">
            Every ledger block, re-verified on load: hashes, chain link,
            property anchor, documents, and registry signature.
          </p>
        </div>
        <form onSubmit={onSearch} className="flex w-full gap-2 sm:w-auto">
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Transaction, property, or hash"
            aria-label="Search ledger hashes"
            className="h-10 w-full min-w-0 rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none sm:w-64"
          />
          <button
            type="submit"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border-subtle px-3 text-sm font-medium text-text-secondary hover:bg-surface-subtle"
          >
            <Icons.Search className="h-4 w-4" />
            Search
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-subtle text-[11px] font-semibold tracking-wider text-text-muted uppercase">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">Transaction</th>
              <th className="px-4 py-3 whitespace-nowrap">Property</th>
              <th className="px-4 py-3 whitespace-nowrap">Block</th>
              <th className="px-4 py-3 whitespace-nowrap">Block hash</th>
              <th className="px-4 py-3 whitespace-nowrap">Chain</th>
              <th className="px-4 py-3 whitespace-nowrap">Integrity</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-text-muted"
                >
                  Verifying ledger blocks…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-danger"
                >
                  {error}
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-text-muted"
                >
                  No ledger blocks matched this search.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const failed = failedHashChecks(row);
                const valid = row.integrity === "VALID";
                return (
                  <tr
                    key={row.blockchain_tx_id}
                    className="border-t border-border-subtle align-top transition-colors hover:bg-surface-subtle/60"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.transaction_id ? (
                        <Link
                          href={`/transactions/${encodeURIComponent(row.transaction_id)}`}
                          className="inline-flex items-center gap-1.5 font-mono text-xs text-link hover:text-link-hover"
                          title={row.transaction_id}
                        >
                          <Icons.Link className="h-3.5 w-3.5 shrink-0" />
                          {row.transaction_id}
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-xs whitespace-nowrap text-text-secondary"
                      title={row.property_id ?? undefined}
                    >
                      {row.property_id
                        ? shortenHash(row.property_id, 8, 4)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-text-secondary tabular-nums">
                      <span className="block">{row.block_number ?? "—"}</span>
                      <span className="block text-xs text-text-muted">
                        {row.block_timestamp
                          ? new Date(row.block_timestamp).toLocaleString()
                          : ""}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-xs whitespace-nowrap text-text-secondary"
                      title={row.tx_hash ?? undefined}
                    >
                      {row.tx_hash ? shortenHash(row.tx_hash) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-text-secondary">
                      {row.chain_position === "GENESIS" ? "Genesis" : "Linked"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={row.integrity ?? "UNKNOWN"}
                        variant={valid ? "success" : "error"}
                        size="sm"
                        icon={valid ? <Icons.GppGood /> : <Icons.GppBad />}
                      />
                      {failed.length > 0 ? (
                        <span className="mt-1 block text-[11px] text-danger">
                          {failed.join(", ")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t border-border-subtle px-5 py-3 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          {total > 0
            ? `${(page * PAGE_SIZE + 1).toLocaleString()}–${Math.min(total, (page + 1) * PAGE_SIZE).toLocaleString()} of ${total.toLocaleString()} blocks`
            : "0 blocks"}
          {!loading && invalidOnPage > 0
            ? ` · ${invalidOnPage} invalid on this page`
            : ""}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={loading || page === 0}
            onClick={() => goToPage(page - 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-2.5 font-medium text-text-secondary hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icons.ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={loading || page >= lastPage}
            onClick={() => goToPage(page + 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-subtle px-2.5 font-medium text-text-secondary hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <Icons.ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
