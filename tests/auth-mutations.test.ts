import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  csrf: vi.fn(), clear: vi.fn(), verify: vi.fn(), hash: vi.fn(),
  find: vi.fn(), update: vi.fn(), rate: vi.fn(),
}));
vi.mock("@/lib/csrf", () => ({ validateCsrfRequest: mocks.csrf }));
vi.mock("@/lib/auth", () => ({ clearSessionCookie: mocks.clear, verifyPassword: mocks.verify, hashPassword: mocks.hash }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.find, update: mocks.update } } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rate }));
vi.mock("@/lib/route-guards", () => ({
  requireApiUser: async () => ({ user: { id: "u1" }, response: null }),
  safeServerError: () => new Response(null, { status: 500 }),
}));
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as changePassword } from "@/app/api/auth/change-password/route";
import { POST as preview } from "@/app/api/properties/import/gestion-isr/preview/route";
import { POST as selectPage } from "@/app/api/integrations/meta/select-page/route";
import { POST as deletion } from "@/app/api/integrations/meta/data-deletion/route";

function request(path: string, body = {}) {
  return new NextRequest("http://localhost" + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.csrf.mockResolvedValue(true);
  mocks.rate.mockReturnValue({ allowed: true });
  mocks.find.mockResolvedValue({ id: "u1", passwordHash: "old" });
  mocks.verify.mockResolvedValue(true);
  mocks.hash.mockResolvedValue("new-hash");
});

describe("authenticated mutations", () => {
  it.each([
    ["/api/auth/logout", logout],
    ["/api/auth/change-password", changePassword],
    ["/api/properties/import/gestion-isr/preview", preview],
    ["/api/integrations/meta/select-page", selectPage],
    ["/api/integrations/meta/data-deletion", deletion],
  ] as const)("requires CSRF for %s", async (path, handler) => {
    mocks.csrf.mockResolvedValue(false);
    expect((await handler(request(path))).status).toBe(403);
    expect(mocks.clear).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("clears the cookie and browser cache after a protected logout", async () => {
    const response = await logout(request("/api/auth/logout"));
    expect(response.status).toBe(200);
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(response.headers.get("clear-site-data")).toBe('"cache"');
  });

  it("revokes all existing sessions when changing the password", async () => {
    const response = await changePassword(request("/api/auth/change-password", {
      currentPassword: "old-password", newPassword: "new-password-long-enough",
    }));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "u1" }, data: { passwordHash: "new-hash", tokenVersion: { increment: 1 } },
    });
    expect(mocks.clear).toHaveBeenCalledOnce();
  });

  it("limits password guesses before verifying the hash", async () => {
    mocks.rate.mockReturnValue({ allowed: false });
    expect((await changePassword(request("/api/auth/change-password"))).status).toBe(429);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
