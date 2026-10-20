import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMetaFromEnvToken = vi.fn();
const createMetaOAuthUrl = vi.fn(() => "https://example.com/meta/oauth");
const createMetaState = vi.fn(() => "state-123");

vi.mock("@/lib/route-guards", () => ({
  requireApiUser: vi.fn(async () => ({ user: { id: "user-1" }, response: null })),
  safeServerError: vi.fn(() => new Response("server error", { status: 500 })),
}));

vi.mock("@/lib/env", () => ({
  env: {
    META_PAGE_ACCESS_TOKEN: "page-token", META_PAGE_ID: "page-1",
    META_APP_ID: "app-1", META_APP_SECRET: "secret",
    META_REDIRECT_URI: "https://example.com/api/integrations/meta/facebook/callback",
  },
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

  it("starts fresh OAuth on explicit reconnect even if an old environment token exists", async () => {
    const { GET } = await import("@/app/api/integrations/meta/facebook/connect/route");
    const response = await GET(new Request("http://localhost/api/integrations/meta/facebook/connect?oauth=1"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/meta/oauth");
    expect(response.headers.get("set-cookie")).toContain("meta_oauth_state=");
    expect(connectMetaFromEnvToken).not.toHaveBeenCalled();
  });
});
