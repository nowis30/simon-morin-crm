import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";
const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: query } }));

describe("health route", () => {
  it("retourne HTTP 200 avec les statuts et la date", async () => {
    query.mockResolvedValueOnce([{ "?column?": 1 }]);
    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(json.database).toBe("up");
    expect(typeof json.serverTime).toBe("string");
  });
  it("retourne HTTP 503 si la base ne répond pas", async () => {
    query.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).status).toBe("degraded");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
