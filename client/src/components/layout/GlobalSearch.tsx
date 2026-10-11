"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import type { OperationalAccessLevel } from "@/lib/auth/types";

type Icon = (typeof Icons)[keyof typeof Icons];

interface SearchTarget {
  id: string;
  label: string;
  icon: Icon;
  /** Page whose search this target opens; it becomes the Enter default there. */
  section?: string;
  levels: OperationalAccessLevel[];
  href: (term: string) => string;
}

const ALL: OperationalAccessLevel[] = [
  "SYSTEM",
  "REGISTRY",
  "COMPANY",
  "PUBLIC"
];
const STAFF: OperationalAccessLevel[] = ["SYSTEM", "REGISTRY", "COMPANY"];

const TARGETS: SearchTarget[] = [
  {
    id: "properties",
    label: "Properties",
    icon: Icons.Search,
    section: "/property-search",
    levels: ALL,
    href: (term) => `/property-search?search=${encodeURIComponent(term)}`
  },
  {
    id: "transactions",
    label: "Transactions",
    icon: Icons.Receipt,
    section: "/transactions",
    levels: STAFF,
    href: (term) => `/transactions?search=${encodeURIComponent(term)}`
  },
  {
    id: "users",
    label: "Users",
    icon: Icons.Group,
    section: "/users",
    levels: STAFF,
    href: (term) => `/users?search=${encodeURIComponent(term)}`
  },
  {
    id: "evidence",
    label: "Evidence (AI retrieval)",
    icon: Icons.AutoAwesome,
    levels: ALL,
    href: (term) => `/property-search?q=${encodeURIComponent(term)}`
  }
];

export function GlobalSearch({
  accessLevel
}: {
  accessLevel: OperationalAccessLevel;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const available = TARGETS.filter((target) =>
    target.levels.includes(accessLevel)
  );
  const current = available.find(
    (target) => target.section && pathname.startsWith(target.section)
  );
  const targets = current
    ? [current, ...available.filter((target) => target !== current)]
    : available;
  const trimmed = term.trim();
  const showMenu = open && trimmed.length > 0;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function go(target: SearchTarget) {
    if (!trimmed) return;
    setOpen(false);
    router.push(target.href(trimmed));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (index + 1) % targets.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + targets.length) % targets.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(targets[active] ?? targets[0]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative hidden min-w-0 flex-1 md:block">
      <Icons.Search className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-[20px] text-text-muted" />
      <input
        type="search"
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showMenu}
        aria-controls="global-search-options"
        aria-label="Search"
        placeholder={
          accessLevel === "PUBLIC"
            ? "Search your properties…"
            : "Search properties, transactions, users…"
        }
        className="h-9 w-full max-w-xs rounded-full border border-border-subtle bg-surface-canvas py-1.5 pr-4 pl-10 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-outline focus:bg-surface lg:max-w-md xl:max-w-xl"
      />

      {showMenu ? (
        <ul
          id="global-search-options"
          role="listbox"
          className="absolute left-0 z-50 mt-2 w-full max-w-xs overflow-hidden rounded-xl border border-border-subtle bg-surface py-1.5 shadow-lg lg:max-w-md xl:max-w-xl"
        >
          {targets.map((target, index) => {
            const TargetIcon = target.icon;
            return (
              <li
                key={target.id}
                role="option"
                aria-selected={index === active}
              >
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(target)}
                  className={`flex w-full items-center gap-3 px-3.5 py-2 text-left text-sm transition-colors ${
                    index === active ? "bg-surface-subtle" : ""
                  }`}
                >
                  <TargetIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 truncate text-text-primary">
                    Search {target.label} for{" "}
                    <span className="font-semibold">“{trimmed}”</span>
                  </span>
                  {index === 0 ? (
                    <span className="ml-auto shrink-0 text-[11px] text-text-muted">
                      Enter
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
