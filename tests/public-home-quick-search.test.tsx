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

    expect(html).toContain("Trouvez votre prochain logement");
    expect(html).toContain("Logements disponibles a Drummondville et dans les environs.");
    expect(html).toContain("Consultez les photos, filtrez les resultats et envoyez votre demande de visite.");
    expect(html).toContain("action=\"/logements\"");
    expect(html).toContain("name=\"city\"");
    expect(html).toContain("name=\"bedrooms\"");
    expect(html).toContain("name=\"maxPrice\"");
    expect(html).toContain("Voir les logements");
    expect(html).toContain("href=\"tel:+18193883407\"");
    expect(html).toContain("href=\"mailto:simonmorin@nowis.store\"");

    const heroSearchIndex = html.indexOf("action=\"/logements\"");
    const listingsIndex = html.indexOf("Selection");
    const promoBlockIndex = html.indexOf("Accompagnement humain et rapide");
    expect(heroSearchIndex).toBeGreaterThan(-1);
    expect(listingsIndex).toBeGreaterThan(heroSearchIndex);
    expect(promoBlockIndex).toBeGreaterThan(listingsIndex);
  });
});
