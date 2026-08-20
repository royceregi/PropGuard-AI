import { Icons } from "@/components/icons";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden bg-background px-4 py-10">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full text-border-subtle"
        aria-hidden
      >
        <defs>
          <pattern
            id="auth-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      <div className="relative w-full max-w-[460px]">{children}</div>
    </div>
  );
}

export function AuthBrandHeader() {
  return (
    <header className="mb-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-text-inverse shadow-sm">
        <Icons.VerifiedUser className="text-[28px]" />
      </div>
      <h1 className="text-xl font-bold tracking-[0.14em] text-text-primary">
        PROPGUARD AI
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">
        Property Transaction Intelligence and Verification Platform
      </p>
    </header>
  );
}

export function AuthSecurityBadge() {
  return (
    <div className="mt-6 flex flex-col items-center gap-2 border-t border-border-subtle pt-5 text-center sm:flex-row sm:justify-center sm:gap-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        Multi-Agent Sentinel: Active
      </span>
      <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-secondary">
        <Icons.Verified className="text-[16px] text-primary" />
        Ethereum / Layer 2 Verified
      </span>
    </div>
  );
}
