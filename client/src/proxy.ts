import { NextResponse, type NextRequest } from "next/server";
import { jwtDecode } from "jwt-decode";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import {
  canAccessPath,
  homeForRole,
  isAuthPage,
  isPublicPage,
} from "@/lib/auth/roles";
import { isUserRole, type UserRole } from "@/lib/auth/types";

interface AccessTokenPayload {
  sub?: string;
  role?: string;
  exp?: number;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSession(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (isAuthPage(pathname)) {
    if (session) {
      return NextResponse.redirect(
        new URL(homeForRole(session.role), request.url),
      );
    }
    return NextResponse.next();
  }

  if (pathname === "/dashboard" && session) {
    return NextResponse.redirect(
      new URL(homeForRole(session.role), request.url),
    );
  }

  if (isPublicPage(pathname)) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(pathname, session.role)) {
    return NextResponse.redirect(
      new URL(homeForRole(session.role), request.url),
    );
  }

  const response = NextResponse.next();
  response.headers.set("x-propguard-role", session.role);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

function readSession(token: string | undefined): { role: UserRole } | null {
  if (!token) {
    return null;
  }

  try {
    const payload = jwtDecode<AccessTokenPayload>(token);
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    if (!isUserRole(payload.role)) {
      return null;
    }
    return { role: payload.role };
  } catch {
    return null;
  }
}
