"use client";

interface AccountStatusToggleProps {
  checked: boolean;
  disabled?: boolean;
  busy?: boolean;
  labelledBy?: string;
  onToggle: (nextActive: boolean) => void;
}

export function AccountStatusToggle({
  checked,
  disabled = false,
  busy = false,
  labelledBy,
  onToggle,
}: AccountStatusToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      disabled={disabled || busy}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(!checked);
      }}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-success" : "bg-border"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
