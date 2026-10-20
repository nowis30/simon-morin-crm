import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { connection, fetchMock } = vi.hoisted(() => ({
  connection: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  fetchMock: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { googleCalendarConnection: connection } }));
vi.mock("@/lib/google-token-crypto", () => ({
  decryptToken: (value: string) => value,
  encryptToken: (value: string) => `encrypted-${value}`,
}));
vi.mock("@/lib/env", () => ({
  env: { GOOGLE_CLIENT_ID: "client", GOOGLE_CLIENT_SECRET: "secret" },
  getGoogleCalendarConfigIssues: () => [],
  googleCalendarId: "primary",
  appTimeZone: "America/Toronto",
}));

import { fetchGoogleBusyRanges, getGoogleCalendarDiagnostic } from "@/lib/google-calendar";

const active = () => ({
  id: "connection-1",
  userId: "user-1",
  calendarId: "primary",
  googleAccountEmail: "owner@example.test",
  accessTokenEncrypted: "private-access-token",
  refreshTokenEncrypted: "private-refresh-token",
  accessTokenExpiresAt: new Date(Date.now() + 60_000),
  scopes: ["https://www.googleapis.com/auth/calendar.events"],
  lastSyncAt: null,
});
const range = {
  userId: "user-1",
  timeMin: "2026-10-20T12:00:00Z",
  timeMax: "2026-10-20T13:00:00Z",
};
const json = (body: unknown, status = 200) => Response.json(body, { status });

describe("Google live diagnostic and availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connection.findUnique.mockResolvedValue(active());
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("verifies the current calendar via metadata without reading or writing events", async () => {
    fetchMock.mockResolvedValueOnce(json({ id: "calendar-id", accessRole: "owner" }));
    const result = await getGoogleCalendarDiagnostic("user-1");
    expect(result.apiVerified).toBe(true);
    expect(result.calendarAccessRole).toBe("owner");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/users/me/calendarList/primary?fields=id,accessRole");
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("method");
    expect(JSON.stringify(result)).not.toContain("private-access-token");
  });

  it.each([401, 403, 404, 503])("does not claim a verified connection after Google HTTP %i", async (status) => {
    fetchMock.mockResolvedValueOnce(json({ error: "sensitive provider detail" }, status));
    const result = await getGoogleCalendarDiagnostic("user-1");
    expect(result.apiVerified).toBe(false);
    expect(result.needsReconnect).toBe(status === 401);
    expect(result.issues).not.toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("sensitive provider detail");
  });

  it("makes no external request for a disconnected account", async () => {
    connection.findUnique.mockResolvedValue(null);
    expect((await getGoogleCalendarDiagnostic("user-1")).apiVerified).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports network failure without exposing credentials", async () => {
    fetchMock.mockRejectedValueOnce(new Error("private-access-token"));
    const result = await getGoogleCalendarDiagnostic("user-1");
    expect(result.apiVerified).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-access-token");
  });

  it.each([
    { calendars: { primary: { errors: [{ reason: "notFound" }], busy: [] } } },
    { calendars: {} },
    { calendars: { primary: {} } },
  ])("rejects incomplete or failed free/busy results instead of offering occupied slots", async (body) => {
    fetchMock.mockResolvedValueOnce(json(body));
    await expect(fetchGoogleBusyRanges(range)).rejects.toThrow("Impossible de verifier");
    expect(connection.updateMany).not.toHaveBeenCalled();
  });

  it("accepts an explicitly empty busy list", async () => {
    fetchMock.mockResolvedValueOnce(json({ calendars: { primary: { busy: [] } } }));
    await expect(fetchGoogleBusyRanges(range)).resolves.toEqual({ source: "GOOGLE", ranges: [] });
  });

  it("requires reconnection when the saved Google authorization has expired", async () => {
    connection.findUnique.mockResolvedValue({ ...active(), accessTokenExpiresAt: new Date(0) });
    fetchMock.mockResolvedValueOnce(json({ error: "invalid_grant" }, 400));
    await expect(fetchGoogleBusyRanges(range)).rejects.toThrow("Reconnexion Google requise");
    expect(connection.updateMany).not.toHaveBeenCalled();
  });
});
