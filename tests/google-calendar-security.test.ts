import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  googleCalendarConnection: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("google calendar security", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-encryption-key-1234567890";
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/integrations/google/calendar/callback";
  });

  it("chiffre et dechiffre les jetons", async () => {
    const { decryptToken, encryptToken } = await import("@/lib/google-token-crypto");
    const encrypted = encryptToken("token-secret");
    const decrypted = decryptToken(encrypted);

    expect(encrypted).not.toBe("token-secret");
    expect(decrypted).toBe("token-secret");
  });

  it("renouvelle un jeton expire via refresh token", async () => {
    const { encryptToken } = await import("@/lib/google-token-crypto");
    const expiredConnection = {
      id: "conn-1",
      userId: "user-1",
      accessTokenEncrypted: encryptToken("expired-access"),
      refreshTokenEncrypted: encryptToken("refresh-123"),
      accessTokenExpiresAt: new Date(Date.now() - 60_000),
      scopes: ["scope-a"],
    };

    prismaMock.googleCalendarConnection.findUnique.mockResolvedValue(expiredConnection);
    prismaMock.googleCalendarConnection.update.mockResolvedValue({ id: "conn-1" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ access_token: "new-access", expires_in: 3600, token_type: "Bearer", scope: "scope-a" }),
      })),
    );

    const { getValidGoogleAccessToken } = await import("@/lib/google-calendar");
    const result = await getValidGoogleAccessToken("user-1");

    expect(result.token).toBe("new-access");
    expect(result.reason).toBe("REFRESHED");
    expect(prismaMock.googleCalendarConnection.update).toHaveBeenCalled();
  });

  it("cree un evenement Google simule", async () => {
    const { encryptToken } = await import("@/lib/google-token-crypto");
    prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
      id: "conn-2",
      userId: "user-1",
      accessTokenEncrypted: encryptToken("active-access"),
      refreshTokenEncrypted: encryptToken("refresh-123"),
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
      scopes: ["scope-a"],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "evt-1", htmlLink: "https://calendar.google.com/event?eid=evt-1" }),
      })),
    );

    const { createGoogleCalendarEvent } = await import("@/lib/google-calendar");
    const event = await createGoogleCalendarEvent({
      userId: "user-1",
      summary: "Visite",
      description: "Description",
      location: "Adresse",
      startsAtIso: "2026-08-08T14:00:00.000Z",
      endsAtIso: "2026-08-08T14:30:00.000Z",
    });

    expect(event.eventId).toBe("evt-1");
    expect(event.eventLink).toContain("calendar.google.com");
  });

  it("gere une erreur Google simulee", async () => {
    const { encryptToken } = await import("@/lib/google-token-crypto");
    prismaMock.googleCalendarConnection.findUnique.mockResolvedValue({
      id: "conn-3",
      userId: "user-1",
      accessTokenEncrypted: encryptToken("active-access"),
      refreshTokenEncrypted: encryptToken("refresh-123"),
      accessTokenExpiresAt: new Date(Date.now() + 60_000),
      scopes: ["scope-a"],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "boom" }),
      })),
    );

    const { createGoogleCalendarEvent } = await import("@/lib/google-calendar");
    await expect(
      createGoogleCalendarEvent({
        userId: "user-1",
        summary: "Visite",
        description: "Description",
        location: "Adresse",
        startsAtIso: "2026-08-08T14:00:00.000Z",
        endsAtIso: "2026-08-08T14:30:00.000Z",
      }),
    ).rejects.toThrow();
  });
});
