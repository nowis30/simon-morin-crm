import { beforeEach, describe, expect, it, vi } from "vitest";

describe("google calendar redirect resolution", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_REDIRECT_URI = "https://simon-morin-agent-location.onrender.com/api/integrations/google/calendar/callback";
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-encryption-key-1234567890";
  });

  it("uses the local callback URL during development when the configured redirect is production-only", async () => {
    const { createGoogleCalendarAuthUrl } = await import("@/lib/google-calendar");
    const url = createGoogleCalendarAuthUrl("user:state", "http://localhost:3000");

    expect(url).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fintegrations%2Fgoogle%2Fcalendar%2Fcallback");
  });

  it("uses the same callback URL when exchanging the OAuth code", async () => {
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      json: async () => ({ access_token: "access-token", expires_in: 3600, token_type: "Bearer", scope: "scope-a" }),
    }));

    vi.stubGlobal("fetch", fetchSpy);

    const { exchangeCodeForGoogleTokens } = await import("@/lib/google-calendar");
    await exchangeCodeForGoogleTokens("auth-code", "http://localhost:3000/api/integrations/google/calendar/callback");

    expect(fetchSpy).toHaveBeenCalled();
    const requestInit = fetchSpy.mock.calls[0]?.[1];
    expect(String(requestInit?.body)).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fintegrations%2Fgoogle%2Fcalendar%2Fcallback");
  });
});
