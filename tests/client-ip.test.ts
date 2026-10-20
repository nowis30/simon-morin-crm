import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp } from "@/lib/route-guards";

afterEach(() => vi.unstubAllEnvs());
it("uses Render's overwritten client header instead of a spoofed forwarding chain", () => {
  vi.stubEnv("RENDER", "true");
  expect(getClientIp(new NextRequest("https://example.com", {
    headers: { "cf-connecting-ip": "203.0.113.3", "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
  }))).toBe("203.0.113.3");
  expect(getClientIp(new NextRequest("https://example.com", {
    headers: { "x-forwarded-for": "1.2.3.4" },
  }))).toBe("unknown");
});
