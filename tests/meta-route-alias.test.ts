import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMetaFromEnvToken = vi.fn();
const createMetaOAuthUrl = vi.fn(() => "https://example.com/meta/oauth");
const createMetaState = vi.fn(() => "state-123");

vi.mock("@/lib/route-guards", () => ({
  requireApiUser: vi.fn(async () => ({ user: { id: "user-1" }, response: null })),
  safeServerError: vi.fn(() => new Response("server error", { status: 500 })),
}));

vi.mock("@/lib/env", () => ({
  env: { META_PAGE_ACCESS_TOKEN: "page-token", META_PAGE_ID: "page-1" },
  getMetaConfigIssues: vi.fn(() => []),
}));

vi.mock("@/lib/meta-facebook", () => ({
  connectMetaFromEnvToken,
  createMetaOAuthUrl,
  createMetaState,
}));

describe("meta connect alias route", () => {
  beforeEach(() => {
    connectMetaFromEnvToken.mockReset();
    createMetaOAuthUrl.mockClear();
    createMetaState.mockClear();
    connectMetaFromEnvToken.mockResolvedValue({ id: "conn-1" });
  });

  it("redirects to the approval page when a page token is configured", async () => {
    const { GET } = await import("@/app/api/integrations/meta/connect/route");
    const response = await GET();

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/marketing/approval?meta=connected");
    expect(connectMetaFromEnvToken).toHaveBeenCalledWith("user-1");
  });
});
