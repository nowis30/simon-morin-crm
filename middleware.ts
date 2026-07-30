import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/",
  "/logements",
  "/contact",
  "/catalog",
  "/login",
  "/setup",
  "/privacy",
  "/data-deletion",
  "/manifest.webmanifest",
  "/sw.js",
  "/workbox-4754cb34.js",
  "/icons",
];

const PUBLIC_API_PATHS = [
  "/api/public",
  "/api/health",
  "/api/csrf",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/setup",
  "/api/integrations/meta/webhook",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/icons") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    const isPublicApi = PUBLIC_API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    if (isPublicApi) {
      return NextResponse.next();
    }
  } else {
    const isPublic = PUBLIC_PATHS.some((path) => path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`));
    if (isPublic) {
      return NextResponse.next();
    }
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
