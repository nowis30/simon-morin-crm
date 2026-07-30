// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

describe("public contact page", () => {
  it("always uses official public call and email links", async () => {
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

    expect(html).toContain("href=\"tel:+18193883407\"");
    expect(html).toContain("href=\"mailto:simonmorin@nowis.store\"");
    expect(html).toContain("href=\"https://m.me/public\"");
  });

  it("keeps official links and hides messenger action when missing", async () => {
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

    expect(html).toContain("href=\"tel:+18193883407\"");
    expect(html).toContain("href=\"mailto:simonmorin@nowis.store\"");
    expect(html).not.toContain("Ouvrir Messenger");
    expect(html).not.toContain("m.me/");
  });
});
