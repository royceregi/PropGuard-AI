"use client";

import { useId, useState } from "react";
import { Icons } from "@/components/icons";

export interface CopyableHashBoxProps {
  value: string;
  displayValue?: string;
  label?: string;
  className?: string;
}

export function CopyableHashBox({
  value,
  displayValue,
  label,
  className
}: CopyableHashBoxProps) {
  const [copied, setCopied] = useState(false);
  const shown = displayValue ?? value;
  const inputId = useId();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-xs font-medium tracking-wide text-text-secondary uppercase"
        >
          {label}
        </label>
      ) : null}

      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2">
        <code
          id={inputId}
          title={value}
          className="min-w-0 flex-1 truncate font-mono text-[13px] text-text-primary"
        >
          {shown}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
          title={copied ? "Copied!" : "Copy"}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
        >
          {copied ? (
            <Icons.Check className="h-[18px] w-[18px] text-success" />
          ) : (
            <Icons.ContentCopy className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
}
