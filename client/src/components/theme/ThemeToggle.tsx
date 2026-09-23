"use client";

import { Icons } from "@/components/icons";
import { useThemeStore } from "@/lib/theme/store";

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      onClick={toggleTheme}
      className={
        className ??
        "inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
      }
    >
      {isDark ? (
        <Icons.LightMode className="h-5 w-5 text-[20px]" />
      ) : (
        <Icons.DarkMode className="h-5 w-5 text-[20px]" />
      )}
    </button>
  );
}
