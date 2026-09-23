import { NextResponse } from "next/server";
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import type { LoginResponse } from "@/lib/auth/types";

const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Invalid email or password" },
      { status: 400 },
    );
  }

  const backendResponse = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await backendResponse.json().catch(() => null)) as
    LoginResponse | { detail?: string } | null;

  if (!backendResponse.ok || !data || !("access_token" in data)) {
    const detail =
      data && "detail" in data && typeof data.detail === "string"
        ? data.detail
        : "Invalid email or password";
    return NextResponse.json(
      { detail },
      { status: backendResponse.status || 401 },
    );
  }

  const response = NextResponse.json(data);
  response.cookies.set(AUTH_COOKIE_NAME, data.access_token, cookieOptions());
  return response;
}
