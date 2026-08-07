import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const makeRouteResponse = async (route: (req: NextRequest) => Promise<Response>, url: string) =>
  route(new NextRequest(url));

const mockAuth = (user: { id: string } | null) => {
  vi.doMock("@/lib/auth", async () => ({
    getCurrentUser: vi.fn(async () => user),
  }));
};

describe("google calendar redirect resolution", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_REDIRECT_URI = "https://simon-morin-agent-location.onrender.com/api/integrations/google/calendar/callback";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-encryption-key-1234567890";
  });

  it("uses the configured redirect URI for the Google authorization request", async () => {
    const { createGoogleCalendarAuthUrl } = await import("@/lib/google-calendar");
    const url = createGoogleCalendarAuthUrl("user:state");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fsimon-morin-agent-location.onrender.com%2Fapi%2Fintegrations%2Fgoogle%2Fcalendar%2Fcallback");
  });

  it("uses the same configured redirect URI when exchanging the OAuth code", async () => {
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => ({ access_token: "access-token", expires_in: 3600, token_type: "Bearer", scope: "scope-a" }),
    }));

    vi.stubGlobal("fetch", fetchSpy);

    const { exchangeCodeForGoogleTokens } = await import("@/lib/google-calendar");
    await exchangeCodeForGoogleTokens("auth-code");

    const requestInit = fetchSpy.mock.calls[0]?.[1];
    expect(String(requestInit?.body)).toContain("redirect_uri=https%3A%2F%2Fsimon-morin-agent-location.onrender.com%2Fapi%2Fintegrations%2Fgoogle%2Fcalendar%2Fcallback");
  });

  it("returns 401 for direct connect without a CRM session", async () => {
    mockAuth(null);
    const { GET } = await import("@/app/api/integrations/google/calendar/connect/route");
    const response = await makeRouteResponse(GET, "http://localhost/api/integrations/google/calendar/connect");
    expect(response.status).toBe(401);
  });

  it("rejects invalid OAuth state", async () => {
    mockAuth({ id: "user-1" });
    vi.doMock("next/headers", async () => ({
      cookies: vi.fn(async () => ({
        get: vi.fn(() => undefined),
        set: vi.fn(),
      })),
    }));
    const { GET } = await import("@/app/api/integrations/google/calendar/callback/route");
    const response = await makeRouteResponse(GET, "http://localhost/api/integrations/google/calendar/callback?code=abc&state=invalid");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("error=invalid_state");
  });

  it("does not leak secrets in the diagnostic payload", async () => {
    mockAuth({ id: "user-1" });
    vi.doMock("@/lib/google-calendar", async () => {
      const actual = await vi.importActual<typeof import("@/lib/google-calendar")>("@/lib/google-calendar");
      return {
        ...actual,
        getGoogleConnectionStatus: vi.fn(async () => ({ connected: false, googleAccountEmail: null })),
      };
    });
    const { GET } = await import("@/app/api/integrations/google/calendar/diagnostic/route");
    const response = await makeRouteResponse(GET, "http://localhost/api/integrations/google/calendar/diagnostic");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).not.toHaveProperty("GOOGLE_CLIENT_SECRET");
  });
});
