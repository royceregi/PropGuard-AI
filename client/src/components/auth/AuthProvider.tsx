"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth/store";
import { isAuthPage } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";
import { isUserRole } from "@/lib/auth/types";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const token = useAuthStore((state) => state.token);

  useEffect(() => {
    if (isAuthPage(pathname)) {
      return;
    }

    let cancelled = false;

    async function hydrate() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (!response.ok) {
          if (!cancelled) {
            clearSession();
          }
          return;
        }
        const data = (await response.json()) as AuthUser;
        if (!cancelled && isUserRole(data.role)) {
          setSession(data, token);
        }
      } catch {
        // Keep any locally restored session if the backend is briefly unavailable.
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [clearSession, pathname, setSession, token]);

  return children;
}
