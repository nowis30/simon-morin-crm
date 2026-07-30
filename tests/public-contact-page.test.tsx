// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("public contact page", () => {
  it("renders phone and email links when configured", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: {
        PUBLIC_CONTACT_PHONE: "819 555-2323",
        PUBLIC_CONTACT_EMAIL: "public@example.com",
        PUBLIC_MESSENGER_URL: "https://m.me/public",
      },
    }));

    const pageModule = await import("@/app/(public)/contact/page");
    const html = renderToStaticMarkup(pageModule.default());

    expect(html).toContain("href=\"tel:8195552323\"");
    expect(html).toContain("href=\"mailto:public@example.com\"");
    expect(html).toContain("href=\"https://m.me/public\"");
  });

  it("hides direct action buttons when values are not configured", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: {
        PUBLIC_CONTACT_PHONE: undefined,
        PUBLIC_CONTACT_EMAIL: undefined,
        PUBLIC_MESSENGER_URL: undefined,
      },
    }));

    const pageModule = await import("@/app/(public)/contact/page");
    const html = renderToStaticMarkup(pageModule.default());

    expect(html).not.toContain("href=\"tel:");
    expect(html).not.toContain("href=\"mailto:");
    expect(html).not.toContain("Ouvrir Messenger");
    expect(html).not.toContain("m.me/");
  });
});
