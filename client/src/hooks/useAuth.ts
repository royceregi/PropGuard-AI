"use client";

import { useAuthStore } from "@/lib/auth/store";
import { homeForAccessLevel } from "@/lib/auth/roles";
import type { AuthUser, LoginResponse } from "@/lib/auth/types";
import { isOperationalAccessLevel } from "@/lib/auth/types";

interface LoginPayload {
  email: string;
  password: string;
}

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);

  async function login(payload: LoginPayload): Promise<AuthUser> {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as
      LoginResponse | { detail?: string } | null;

    if (!response.ok) {
      const detail =
        data && "detail" in data && typeof data.detail === "string"
          ? data.detail
          : "Invalid email or password";
      throw new Error(detail);
    }

    const loginData = data as LoginResponse;
    setSession(loginData.user, loginData.access_token);
    return loginData.user;
  }

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    clearSession();
  }

  return {
    user,
    token,
    isAuthenticated: Boolean(user),
    login,
    logout,
    homePath:
      user && isOperationalAccessLevel(user.access_level)
        ? homeForAccessLevel(user.access_level)
        : "/login",
  };
}
