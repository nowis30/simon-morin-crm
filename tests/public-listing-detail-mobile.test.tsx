// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = {
  rentalUnit: { findUnique: vi.fn() },
  property: { findFirst: vi.fn(), findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

describe("public listing detail mobile", () => {
  it("renders visit section order with fixed mobile CTA when listing is available", async () => {
    mockPrisma.rentalUnit.findUnique.mockResolvedValue({
      id: "unit-1",
      status: "AVAILABLE",
      isPubliclyVisible: true,
      bedrooms: 2,
      monthlyPrice: 1450,
      propertyType: "Appartement",
      publicDescription: "Bel espace lumineux",
      description: "Bel espace lumineux",
      petsAllowed: true,
      parking: true,
      inclusions: "Chauffage",
      primaryPhotoUrl: "https://cdn.example.com/unit-1.jpg",
      building: {
        address: "123 rue Test",
        city: "Drummondville",
        district: "Centre",
        photos: [{ url: "https://cdn.example.com/building-1.jpg", description: "Facade", sortOrder: 0 }],
      },
      photos: [{ url: "https://cdn.example.com/unit-2.jpg", description: "Salon", sortOrder: 0 }],
    });
    mockPrisma.property.findFirst.mockResolvedValue({ id: "property-1" });

    const pageModule = await import("@/app/(public)/logements/[id]/page");
    const pageElement = await pageModule.default({ params: Promise.resolve({ id: "unit-1" }) });
    const html = renderToStaticMarkup(pageElement);

    expect(html).toContain("Retour aux logements");
    expect(html).toContain("Demander une visite");
    expect(html).toContain("id=\"visit-request-form\"");
    expect(html).toContain("Prix mensuel");

    const galleryIndex = html.indexOf("Plein écran");
    const priceIndex = html.indexOf("$ / mois");
    const formIndex = html.indexOf("id=\"visit-request-form\"");
    const shareIndex = html.indexOf("Partager ce logement");

    expect(galleryIndex).toBeGreaterThan(-1);
    expect(priceIndex).toBeGreaterThan(galleryIndex);
    expect(formIndex).toBeGreaterThan(priceIndex);
    expect(shareIndex).toBeGreaterThan(formIndex);
  });
});
