import Link from "next/link";

const ROLE_LINKS = [
  { href: "/login", label: "Super Admin portal" },
  { href: "/login", label: "Land Registry portal" },
  { href: "/login", label: "Real Estate Company portal" },
  { href: "/login", label: "Public title passbook" },
] as const;

export function LandingFooter() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0";
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-[#03101c] px-4 py-10 text-slate-400 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md">
          <p className="text-sm font-semibold text-white">PropGuard AI</p>
          <p className="mt-2 text-xs leading-relaxed">
            Academic prototype for property transaction intelligence and
            verification. Not a statutory government registry and not a real
            estate marketplace.
          </p>
          <p className="mt-4 text-[11px]">System version {version}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-secondary uppercase">
            Role-access portals
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {ROLE_LINKS.map((item) => (
              <li key={item.label}>
                <Link href={item.href} className="hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-6xl border-t border-white/10 pt-6 text-[11px]">
        © {year} PropGuard AI. All rights reserved.
      </p>
    </footer>
  );
}
