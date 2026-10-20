import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => {
  throw new Error("Server credentials are unavailable in a browser");
});

describe("calendar client boundary", () => {
  it("loads the settings UI without importing server credentials", async () => {
    const { CalendarSettingsClient } = await import("@/components/calendar-settings-client");
    expect(CalendarSettingsClient).toBeTypeOf("function");
  });
});
