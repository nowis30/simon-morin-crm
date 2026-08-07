import { beforeEach, describe, expect, it, vi } from "vitest";

describe("environment parsing", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.SESSION_SECRET = "test_secret_that_is_long_enough_for_unit_tests_only";
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.PUBLIC_MESSENGER_URL = "";
    process.env.META_PAGE_URL = "";
  });

  it("treats blank optional URL values as undefined", async () => {
    const { env } = await import("@/lib/env");
    expect(env.NEXT_PUBLIC_APP_URL).toBeUndefined();
    expect(env.PUBLIC_MESSENGER_URL).toBeUndefined();
    expect(env.META_PAGE_URL).toBeUndefined();
  });
});
