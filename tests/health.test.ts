import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("health route", () => {
  it("retourne HTTP 200 avec les statuts et la date", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.status).toBe("ok");
    expect(["up", "down"]).toContain(json.database);
    expect(typeof json.serverTime).toBe("string");
  });
});
