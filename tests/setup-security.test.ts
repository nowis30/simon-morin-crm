import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { checkSetupToken } from "@/lib/setup-token";

const mocks = vi.hoisted(() => ({ csrf: vi.fn(), exists: vi.fn(), hash: vi.fn(), create: vi.fn(), count: vi.fn(), lock: vi.fn(), session: vi.fn(), cookie: vi.fn() }));
vi.mock("@/lib/csrf", () => ({ validateCsrfToken: mocks.csrf }));
vi.mock("@/lib/auth", () => ({ hasAnyAdmin: mocks.exists, hashPassword: mocks.hash, createSessionToken: mocks.session, setSessionCookie: mocks.cookie }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (callback: (tx: unknown) => unknown) => callback({ $queryRaw: mocks.lock, user: { count: mocks.count, create: mocks.create } }) } }));
import { POST } from "@/app/api/setup/route";

const token = "unit-test-bootstrap-secret-00000000000000000000";
function request(setupToken?: string) {
  return new NextRequest("http://localhost/api/setup", {
    method: "POST", headers: { "Content-Type": "application/json", "x-csrf-token": "test-csrf", ...(setupToken ? { "x-setup-token": setupToken } : {}) },
    body: JSON.stringify({ name: "Test Admin", email: "admin@example.test", password: "test-admin-password-long" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("SETUP_TOKEN", token);
  mocks.csrf.mockResolvedValue(true); mocks.exists.mockResolvedValue(false);
  mocks.hash.mockResolvedValue("hash"); mocks.count.mockResolvedValue(0);
  mocks.create.mockResolvedValue({ id: "admin-id", email: "admin@example.test", tokenVersion: 0 });
  mocks.session.mockResolvedValue("session-token");
});
afterEach(() => vi.unstubAllEnvs());

describe("first-administrator setup", () => {
  it("fails closed without a strong configured secret", async () => {
    for (const value of ["", "short"]) {
      vi.stubEnv("SETUP_TOKEN", value);
      expect((await POST(request(token))).status).toBe(503);
    }
    expect(mocks.hash).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it.each([undefined, "incorrect", "x".repeat(513)])("rejects unauthorized bootstrap before hashing or creating a user", async (candidate) => {
    expect((await POST(request(candidate))).status).toBe(403);
    expect(mocks.hash).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("retains CSRF protection even with a valid bootstrap secret", async () => {
    mocks.csrf.mockResolvedValue(false);
    expect((await POST(request(token))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("creates a first administrator only with both protections and the database lock", async () => {
    expect((await POST(request(token))).status).toBe(200);
    expect(mocks.lock).toHaveBeenCalledOnce(); expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.cookie).toHaveBeenCalledWith("session-token");
  });
  it("preserves the existing-installation and concurrent-setup guards", async () => {
    mocks.exists.mockResolvedValue(true);
    expect((await POST(request())).status).toBe(409);
    mocks.exists.mockResolvedValue(false); mocks.count.mockResolvedValue(1);
    expect((await POST(request(token))).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.cookie).not.toHaveBeenCalled();
  });
  it("compares complete secrets without accepting prefixes", () => {
    expect(checkSetupToken(token, token)).toBe("valid");
    expect(checkSetupToken(token.slice(0, -1), token)).toBe("invalid");
    expect(checkSetupToken(token + "x", token)).toBe("invalid");
  });
});
