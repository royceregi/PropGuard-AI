"use client";

import { useState } from "react";
import { Icons } from "@/components/icons";

export function FilterBar() {
  const [aiSearch, setAiSearch] = useState(true);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Icons.Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by address, TX ID, or natural language query..."
            className="h-11 w-full rounded-lg border border-border bg-surface-canvas py-2 pl-10 pr-4 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary focus:bg-surface"
          />
        </div>
        <div className="flex items-center gap-3 self-end md:self-auto">
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 transition-colors hover:bg-surface-canvas">
            <div
              className={`relative h-5 w-9 rounded-full transition-colors ${
                aiSearch ? "bg-primary" : "bg-border-subtle"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  aiSearch ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
            <span className="text-sm font-medium text-text-primary flex items-center gap-1">
              <Icons.AutoAwesome className="h-[18px] w-[18px] text-primary" />
              AI Search
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={aiSearch}
              onChange={(e) => setAiSearch(e.target.checked)}
            />
          </label>
          <button className="flex h-11 items-center justify-center rounded-lg bg-primary px-6 font-medium text-white transition-colors hover:bg-primary-hover">
            Search
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {["Any Year", "All Areas", "Property Type"].map((filter) => (
            <button
              key={filter}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm text-text-secondary transition-colors hover:bg-surface-canvas"
            >
              {filter}
              <Icons.KeyboardArrowDown className="h-[18px] w-[18px]" />
            </button>
          ))}
          <button className="flex h-9 items-center gap-1.5 rounded-lg border-2 border-primary bg-primary-subtle px-3 text-sm font-medium text-primary transition-colors">
            Risk Level
            <Icons.KeyboardArrowDown className="h-[18px] w-[18px]" />
          </button>
          <button className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm text-text-secondary transition-colors hover:bg-surface-canvas">
            Blockchain Status
            <Icons.KeyboardArrowDown className="h-[18px] w-[18px]" />
          </button>
        </div>
        <button className="flex h-9 items-center gap-1.5 rounded-lg text-sm font-medium text-text-secondary transition-colors hover:text-text-primary">
          <Icons.Tune className="h-5 w-5" />
          More Filters
        </button>
      </div>
    </div>
  );
}
