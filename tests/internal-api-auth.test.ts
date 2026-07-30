import { describe, expect, it, vi } from "vitest";

const unauthorizedResponse = new Response(JSON.stringify({ error: "Authentification requise" }), {
  status: 401,
  headers: { "content-type": "application/json" },
});

vi.mock("@/lib/route-guards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/route-guards")>("@/lib/route-guards");
  return {
    ...actual,
    requireApiUser: vi.fn(async () => ({ user: null, response: unauthorizedResponse })),
  };
});

describe("internal API auth", () => {
  it("rejects unauthenticated access to /api/properties", async () => {
    const { GET } = await import("@/app/api/properties/route");
    const response = await GET(new Request("http://localhost/api/properties") as any);

    expect(response.status).toBe(401);
  });
});
