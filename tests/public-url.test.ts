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

  it("prefers RENDER_EXTERNAL_URL over a stale NEXT_PUBLIC_APP_URL value", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://logements.nowis.store";
    process.env.RENDER_EXTERNAL_URL = "https://simon-morin-agent-location.onrender.com";

    expect(getPublicAppUrl()).toBe("https://simon-morin-agent-location.onrender.com");
  });

  it("uses the local port fallback when no deployment URL is configured", () => {
    process.env.PORT = "10000";

    expect(getPublicAppUrl()).toBe("http://127.0.0.1:10000");
  });
});
