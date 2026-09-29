import { NextResponse, type NextRequest } from "next/server";
import { jwtDecode } from "jwt-decode";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import {
  canAccessPath,
  homeForAccessLevel,
  isAuthPage,
  isPublicPage
} from "@/lib/auth/roles";
import {
  isOperationalAccessLevel,
  type OperationalAccessLevel
} from "@/lib/auth/types";

interface AccessTokenPayload {
  sub?: string;
  access_level?: string;
  /** Legacy JWT claim — ignored when access_level is present. */
  role?: string;
  exp?: number;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSession(request.cookies.get(AUTH_COOKIE_NAME)?.value);

  if (isAuthPage(pathname)) {
    if (session) {
      return NextResponse.redirect(
        new URL(homeForAccessLevel(session.accessLevel), request.url)
      );
    }
    return NextResponse.next();
  }

  if (pathname === "/dashboard" && session) {
    return NextResponse.redirect(
      new URL(homeForAccessLevel(session.accessLevel), request.url)
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

  if (!canAccessPath(pathname, session.accessLevel)) {
    return NextResponse.redirect(
      new URL(homeForAccessLevel(session.accessLevel), request.url)
    );
  }

  const response = NextResponse.next();
  response.headers.set("x-propguard-access-level", session.accessLevel);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};

function readSession(
  token: string | undefined
): { accessLevel: OperationalAccessLevel } | null {
  if (!token) {
    return null;
  }

  try {
    const payload = jwtDecode<AccessTokenPayload>(token);
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }
    const level = payload.access_level || payload.role;
    if (!isOperationalAccessLevel(level)) {
      return null;
    }
    return { accessLevel: level };
  } catch {
    return null;
  }
}
