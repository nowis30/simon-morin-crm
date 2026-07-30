// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync } from "node:fs";

vi.mock("@/lib/env", () => ({
  env: {
    PUBLIC_CONTACT_PHONE: "819 555-1212",
    PUBLIC_CONTACT_EMAIL: "contact@example.com",
    PUBLIC_MESSENGER_URL: "https://m.me/test",
  },
}));

describe("public layout and contact routing", () => {
  it("keeps homepage route in public group and removes legacy root page", () => {
    expect(existsSync("src/app/(public)/page.tsx")).toBe(true);
    expect(existsSync("src/app/page.tsx")).toBe(false);
  });

  it("points Contact navigation to /contact", async () => {
    const module = await import("@/app/(public)/layout");
    const html = renderToStaticMarkup(module.default({ children: <div>content</div> }));
    expect(html).toContain("href=\"/contact\"");
    expect(html).not.toContain("/#contact");
  });
});
