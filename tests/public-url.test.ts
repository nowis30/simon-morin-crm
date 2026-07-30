import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPublicAppUrl } from "@/lib/public-url";

describe("getPublicAppUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses RENDER_EXTERNAL_URL when NEXT_PUBLIC_APP_URL is not set", () => {
    process.env.RENDER_EXTERNAL_URL = "https://example.onrender.com";

    expect(getPublicAppUrl()).toBe("https://example.onrender.com");
  });
});
