"use client";

import { useEffect } from "react";
import { applyThemeClass, useThemeStore } from "@/lib/theme/store";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  useEffect(() => {
    void useThemeStore.persist.rehydrate();
  }, []);

  return children;
}
