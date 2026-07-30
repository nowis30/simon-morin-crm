import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findMetaConnection,
  decryptMetaToken,
} = vi.hoisted(() => ({
  findMetaConnection: vi.fn(),
  decryptMetaToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    metaConnection: {
      findUnique: findMetaConnection,
    },
  },
}));

vi.mock("@/lib/meta-token-crypto", () => ({
  decryptMetaToken,
  encryptMetaToken: vi.fn((value: string) => `enc-${value}`),
}));

vi.mock("@/lib/env", () => ({
  env: {
    META_APP_ID: "app-1",
    META_APP_SECRET: "secret-1",
    META_REDIRECT_URI: "https://logements.nowis.store/api/integrations/meta/facebook/callback",
    META_PAGE_ID: "page-1",
    META_PAGE_ACCESS_TOKEN: undefined,
    META_TOKEN_ENCRYPTION_KEY: "enc-key",
    META_GRAPH_API_VERSION: "v20.0",
    NEXT_PUBLIC_APP_URL: "https://logements.nowis.store",
  },
  getMetaConfigIssues: vi.fn(() => []),
  isMetaConfigured: true,
}));

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("Meta diagnostic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://logements.nowis.store";
    findMetaConnection.mockResolvedValue(null);
    decryptMetaToken.mockImplementation((value: string) => value);
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ id: "page-1", name: "Simon Page" }));
  });

  it("returns configuration issues when mandatory values are missing", async () => {
    const envModule = await import("@/lib/env");
    envModule.env.META_APP_ID = undefined;

    const { getMetaDiagnostic } = await import("@/lib/meta-facebook");
    const result = await getMetaDiagnostic("user-1");

    expect(result.configured).toBe(false);
    expect(result.issues.some((issue) => issue.includes("META_APP_ID"))).toBe(true);

    envModule.env.META_APP_ID = "app-1";
  });

  it("reports missing page token safely", async () => {
    const { getMetaDiagnostic } = await import("@/lib/meta-facebook");
    const result = await getMetaDiagnostic("user-1");

    expect(result.tokenValid).toBe(false);
    expect(result.issues.some((issue) => issue.includes("Jeton de Page Facebook absent"))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret-1");
  });

  it("detects invalid token and returns safe issue", async () => {
    findMetaConnection.mockResolvedValue({
      id: "conn-1",
      pageAccessTokenEncrypted: "encrypted-page",
      userAccessTokenEncrypted: null,
      pageName: "Simon Page",
      scopes: [],
    });
    decryptMetaToken.mockReturnValue("token-secret");

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Invalid OAuth", code: 190 } }, false, 400))
      .mockResolvedValueOnce(jsonResponse({ data: { is_valid: false } }));

    const { getMetaDiagnostic } = await import("@/lib/meta-facebook");
    const result = await getMetaDiagnostic("user-1");

    expect(result.tokenValid).toBe(false);
    expect(result.tokenRevoked).toBe(true);
    expect(result.issues.some((issue) => issue.includes("expire") || issue.includes("invalide"))).toBe(true);
    expect(JSON.stringify(result)).not.toContain("token-secret");
  });

  it("detects missing permission", async () => {
    findMetaConnection.mockResolvedValue({
      id: "conn-1",
      pageAccessTokenEncrypted: "encrypted-page",
      userAccessTokenEncrypted: "encrypted-user",
      pageName: "Simon Page",
      scopes: ["pages_show_list", "pages_read_engagement"],
    });

    decryptMetaToken.mockImplementation((value: string) => {
      if (value === "encrypted-page") return "page-token";
      return "user-token";
    });

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ id: "page-1", name: "Simon Page" }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "page-1", name: "Simon Page", perms: ["pages_show_list"] }] }))
      .mockResolvedValueOnce(jsonResponse({ data: { is_valid: true, scopes: ["pages_show_list"] } }));

    const { getMetaDiagnostic } = await import("@/lib/meta-facebook");
    const result = await getMetaDiagnostic("user-1");

    expect(result.missingScopes).toContain("pages_manage_posts");
    expect(result.issues.some((issue) => issue.includes("pages_manage_posts"))).toBe(true);
  });

  it("detects configured page not found in /me/accounts", async () => {
    findMetaConnection.mockResolvedValue({
      id: "conn-1",
      pageAccessTokenEncrypted: "encrypted-page",
      userAccessTokenEncrypted: "encrypted-user",
      pageName: "Simon Page",
      scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    });

    decryptMetaToken.mockImplementation((value: string) => {
      if (value === "encrypted-page") return "page-token";
      return "user-token";
    });

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ id: "page-1", name: "Simon Page" }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: "another-page", name: "Other", perms: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"] }] }))
      .mockResolvedValueOnce(jsonResponse({ data: { is_valid: true, scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"] } }));

    const { getMetaDiagnostic } = await import("@/lib/meta-facebook");
    const result = await getMetaDiagnostic("user-1");

    expect(result.issues.some((issue) => issue.includes("n'est pas accessible"))).toBe(true);
  });

  it("returns graph API version in the payload", async () => {
    findMetaConnection.mockResolvedValue({
      id: "conn-1",
      pageAccessTokenEncrypted: "encrypted-page",
      userAccessTokenEncrypted: null,
      pageName: "Simon Page",
      scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    });
    decryptMetaToken.mockReturnValue("page-token");

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ id: "page-1", name: "Simon Page" }))
      .mockResolvedValueOnce(jsonResponse({ data: { is_valid: true, scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"] } }));

    const { getMetaDiagnostic } = await import("@/lib/meta-facebook");
    const result = await getMetaDiagnostic("user-1");

    expect(result.graphApiVersion).toBe("v20.0");
  });
});
