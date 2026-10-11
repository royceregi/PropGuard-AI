"use client";

import { Icons } from "@/components/icons";

export function SearchTermChip({
  term,
  onClear
}: {
  term: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary-subtle-alt bg-primary-subtle px-3 py-2 text-sm text-text-primary">
      <Icons.Search className="h-4 w-4 text-primary" />
      <span>
        Showing results for <span className="font-semibold">“{term}”</span>
      </span>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-link hover:text-link-hover"
      >
        <Icons.Close className="!h-3.5 !w-3.5" />
        Clear search
      </button>
    </div>
  );
}
