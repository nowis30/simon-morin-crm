import { NextRequest, NextResponse } from "next/server";

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
  "/register-sw.js",
  "/robots.txt",
  "/sitemap.xml",
  "/logo.png",
  "/annonce.png",
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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/icons") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    const isPublicApi = PUBLIC_API_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    if (isPublicApi) {
      const response = NextResponse.next();
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
  } else {
    const isPublic = PUBLIC_PATHS.some((path) => path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`));
    if (isPublic) {
      return NextResponse.next();
    }
  }

  const token = request.cookies.get("simon_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentification requise" }, {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
