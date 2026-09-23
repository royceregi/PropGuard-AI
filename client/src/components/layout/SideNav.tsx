"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons, navIcons } from "@/components/icons";
import { visibleNavItems } from "@/components/layout/nav";
import { useAuthStore } from "@/lib/auth/store";

export function SideNav({
  open,
  collapsed,
  onClose,
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const accessLevel = useAuthStore((state) => state.user?.access_level);
  const navItems = visibleNavItems(accessLevel);
  const settingsItem = navItems.find((item) => item.id === "settings");
  const isSettingsActive =
    pathname === "/settings" || pathname.startsWith("/settings/");

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-64 shrink-0 select-none flex-col bg-black text-text-muted transition-[width,transform] duration-200 md:static md:z-0 md:translate-x-0 ${
        collapsed ? "md:w-20" : "md:w-64 xl:w-72"
      } ${open ? "translate-x-0" : "-translate-x-full"}`}
    >
      <div
        className={`flex h-14 items-center gap-3 border-b border-surface-inverse px-5 sm:h-16 ${
          collapsed ? "md:justify-center md:px-2" : "md:justify-start md:px-5"
        }`}
      >
        <Link
          href="/"
          title="PropGuard AI home"
          className="flex min-w-0 items-center gap-3"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black shadow-md">
            <Icons.AccountBalance className="h-7 w-7 text-[28px]" />
          </div>
          <div className={`min-w-0 ${collapsed ? "md:hidden" : ""}`}>
            <h2 className="text-[15px] font-bold leading-tight tracking-wide text-white">
              PropGuard AI
            </h2>
            <p className="mt-0.5 text-[10px] font-semibold tracking-[0.12em] text-gray-400 uppercase">
              Blockchain + Multi-Agent AI
            </p>
          </div>
        </Link>
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="ml-auto rounded-md p-1 text-gray-400 hover:bg-white/10 hover:text-white md:hidden"
        >
          <Icons.Close className="h-5 w-5 text-[20px]" />
        </button>
      </div>

      <nav
        className={`mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-3 ${
          collapsed ? "md:items-center md:px-0" : "md:px-3"
        }`}
        aria-label="Main"
      >
        {navItems
          .filter((item) => item.id !== "settings")
          .map((item) => {
            const Icon = navIcons[item.id];
            const isActive =
              item.id === "dashboard" || item.href.startsWith("/dashboard")
                ? pathname.startsWith("/dashboard")
                : item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                onClick={onClose}
                className={`relative flex items-center text-sm font-medium transition-colors ${
                  collapsed
                    ? "w-full gap-3 rounded-lg px-3.5 py-2.5 md:h-11 md:w-11 md:justify-center md:rounded-xl md:p-0"
                    : "w-full gap-3 rounded-lg px-3.5 py-2.5"
                } ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {isActive ? (
                  <span
                    className={`absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-primary ${
                      collapsed ? "md:hidden" : ""
                    }`}
                  />
                ) : null}
                {Icon ? (
                  <Icon className="h-5 w-5 shrink-0 text-[20px]" />
                ) : null}
                <span
                  className={`whitespace-nowrap ${collapsed ? "md:hidden" : ""}`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
      </nav>

      <div
        className={`flex flex-col px-3 pb-4 pt-2 ${
          collapsed ? "md:items-center md:px-0" : "md:px-3"
        }`}
      >
        <div className="mb-4 h-px w-full bg-white/10" />

        {settingsItem ? (
          <Link
            href={settingsItem.href}
            title={settingsItem.label}
            onClick={onClose}
            className={`relative flex items-center text-sm font-medium transition-colors ${
              collapsed
                ? "w-full gap-3 rounded-lg px-3.5 py-2.5 md:h-11 md:w-11 md:justify-center md:rounded-xl md:p-0"
                : "w-full gap-3 rounded-lg px-3.5 py-2.5"
            } ${
              isSettingsActive
                ? "bg-white/10 text-white"
                : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            {isSettingsActive ? (
              <span
                className={`absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-primary ${
                  collapsed ? "md:hidden" : ""
                }`}
              />
            ) : null}
            <Icons.Settings className="h-5 w-5 shrink-0 text-[20px]" />
            <span
              className={`whitespace-nowrap ${collapsed ? "md:hidden" : ""}`}
            >
              {settingsItem.label}
            </span>
          </Link>
        ) : null}
      </div>
    </aside>
  );
}
