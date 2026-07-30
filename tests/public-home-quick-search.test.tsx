// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockFetch = vi.fn();

describe("home quick search", () => {
  it("renders quick search form targeting /logements query params", async () => {
    vi.resetModules();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
    vi.stubGlobal("fetch", mockFetch as unknown as typeof fetch);

    const pageModule = await import("@/app/(public)/page");
    const element = await pageModule.default();
    const html = renderToStaticMarkup(element);

    expect(html).toContain("action=\"/logements\"");
    expect(html).toContain("name=\"city\"");
    expect(html).toContain("name=\"bedrooms\"");
    expect(html).toContain("name=\"maxPrice\"");
  });
});
