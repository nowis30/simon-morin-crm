import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy as middleware } from "@/proxy";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

describe("middleware public/private separation", () => {
  it("allows public pages without authentication", () => {
    const publicRequests = [
      new NextRequest("http://localhost/"),
      new NextRequest("http://localhost/logements"),
      new NextRequest("http://localhost/logements/unit-1"),
      new NextRequest("http://localhost/contact"),
      new NextRequest("http://localhost/api/public/catalog"),
      new NextRequest("http://localhost/api/public/contact"),
    ];

    for (const request of publicRequests) {
      const response = middleware(request);
      expect(response.status).toBe(200);
    }
  });

  it("redirects private pages to login when not authenticated", () => {
    const request = new NextRequest("http://localhost/dashboard");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("redirects private administration pages to login when not authenticated", () => {
    const request = new NextRequest("http://localhost/admin/logements");
    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("rejects internal APIs with JSON and disables caching", () => {
    const request = new NextRequest("http://localhost/api/properties");
    const response = middleware(request);

    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("allows private pages when an auth cookie exists", () => {
    const request = new NextRequest("http://localhost/dashboard", {
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=session-token`,
      },
    });

    const response = middleware(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
