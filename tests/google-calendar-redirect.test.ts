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
});
