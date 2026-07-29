import { describe, expect, it, vi } from "vitest";
import { POST as previewRoute } from "@/app/api/properties/import/gestion-isr/preview/route";
import { POST as applyRoute } from "@/app/api/properties/import/gestion-isr/apply/route";
import { fetchGestionIsrListings } from "@/integrations/gestion-isr/importer";

vi.mock("@/integrations/gestion-isr/importer", async () => {
  const actual = await vi.importActual<typeof import("@/integrations/gestion-isr/importer")>("@/integrations/gestion-isr/importer");
  return {
    ...actual,
    fetchGestionIsrListings: vi.fn(),
  };
});

vi.mock("@/lib/route-guards", async () => {
  const actual = await vi.importActual<typeof import("@/lib/route-guards")>("@/lib/route-guards");
  return {
    ...actual,
    requireApiUser: vi.fn(async () => ({ user: { id: "user-1" }, response: null })),
  };
});

describe("gestion ISR preview/apply", () => {
  it("returns a preview without writing data", async () => {
    vi.mocked(fetchGestionIsrListings).mockResolvedValueOnce([
      {
        codeIsr: "ISR-001",
        address: "123 Rue Example",
        city: "Quebec",
        monthlyPrice: 1500,
        bedrooms: 2,
        propertyType: "Appartement",
        descriptionFr: "Disponible",
        sourceStatus: "Disponible",
        photoUrls: [],
      },
    ]);

    const response = await previewRoute(new Request("http://localhost/api/properties/import/gestion-isr/preview", { method: "POST", body: JSON.stringify({ url: "https://example.test" }) }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.previewId).toBeTruthy();
    expect(json.summary[0].status).toBe("AVAILABLE");
  });

  it("refuses apply without preview id", async () => {
    const response = await applyRoute(new Request("http://localhost/api/properties/import/gestion-isr/apply", { method: "POST", body: JSON.stringify({ url: "https://example.test" }) }));
    expect(response.status).toBe(400);
  });
});
