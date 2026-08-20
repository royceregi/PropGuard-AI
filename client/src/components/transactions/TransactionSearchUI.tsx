"use client";

import { useState } from "react";
import { FilterBar } from "@/components/transactions/FilterBar";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import { Icons } from "@/components/icons";

const sampleTransactions: React.ComponentProps<typeof TransactionCard>[] = [
  {
    id: "tx-1",
    address: "1042 Market St, Suite 400",
    area: "Downtown District",
    date: "Oct 24, 2023",
    value: "$4.2M",
    propertyType: "Commercial Office",
    txId: "0x8f...3c9a",
    riskLevel: "Low Risk",
    verificationStatus: "Verified",
  },
  {
    id: "tx-2",
    address: "755 Riverside Blvd",
    area: "Waterfront Area",
    date: "Oct 21, 2023",
    value: "$12.5M",
    propertyType: "Mixed Use",
    txId: "0x4a...1b8c",
    riskLevel: "Med Risk",
    verificationStatus: "Verified",
  },
  {
    id: "tx-3",
    address: "12 Oak Tree Lane",
    area: "North Suburbs",
    date: "Oct 19, 2023",
    value: "$850k",
    propertyType: "Residential Single",
    txId: "0x22...9f4e",
    riskLevel: "Low Risk",
    verificationStatus: "Pending",
  },
];

export function TransactionSearchUI() {
  const [view, setView] = useState<"grid" | "list">("grid");

  return (
    <div className="flex flex-col gap-6">
      <FilterBar />

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary md:text-lg">
          1,245 Results Found
        </h2>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
          <button
            onClick={() => setView("list")}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              view === "list"
                ? "bg-primary-subtle text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
            aria-label="List view"
          >
            <Icons.ViewList className="h-5 w-5" />
          </button>
          <button
            onClick={() => setView("grid")}
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
              view === "grid"
                ? "bg-primary-subtle text-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
            aria-label="Grid view"
          >
            <Icons.GridView className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        className={
          view === "grid"
            ? "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-6"
            : "flex flex-col gap-4"
        }
      >
        {sampleTransactions.map((tx) => (
          <TransactionCard key={tx.id} {...tx} />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center">
        <nav
          className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1"
          aria-label="Pagination"
        >
          <button className="flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-canvas hover:text-text-primary">
            Previous
          </button>

          <button className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-medium text-white transition-colors">
            1
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium text-text-secondary transition-colors hover:bg-surface-canvas hover:text-text-primary">
            2
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium text-text-secondary transition-colors hover:bg-surface-canvas hover:text-text-primary">
            3
          </button>

          <span className="flex h-9 w-9 items-center justify-center text-sm font-medium text-text-muted">
            ...
          </span>

          <button className="flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium text-text-secondary transition-colors hover:bg-surface-canvas hover:text-text-primary">
            42
          </button>

          <button className="flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-canvas hover:text-text-primary">
            Next
          </button>
        </nav>
      </div>
    </div>
  );
}
