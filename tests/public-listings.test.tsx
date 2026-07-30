// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";
import { ListingPhotoGallery } from "../src/components/public/listing-photo-gallery.tsx";

const mockPrisma = {
  rentalUnit: { count: vi.fn(), findMany: vi.fn() },
  property: { count: vi.fn(), findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("public listing catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.rentalUnit.count.mockResolvedValue(1);
    mockPrisma.property.count.mockResolvedValue(0);
    mockPrisma.property.findMany.mockResolvedValue([]);
  });

  it("returns imageUrl and photoCount from unit and building photos with deduplication", async () => {
    mockPrisma.rentalUnit.findMany.mockResolvedValue([
      {
        id: "unit-1",
        codeIsr: "ISR-1",
        monthlyPrice: 1500,
        bedrooms: 2,
        propertyType: "Appartement",
        status: "AVAILABLE",
        isPubliclyVisible: true,
        description: "Grand 4 et demi",
        publicDescription: "Grand 4 et demi",
        petsAllowed: true,
        parking: false,
        inclusions: "",
        primaryPhotoUrl: "https://cdn.example.com/unit-main.jpg",
        displayOrder: 1,
        building: {
          address: "123 rue Example",
          city: "Montréal",
          district: "Plateau",
          name: "Le Bâtiment",
          photos: [{ url: "https://cdn.example.com/building-1.jpg", description: "Entrée", sortOrder: 0 }],
          _count: { photos: 1 },
        },
        photos: [
          { url: "https://cdn.example.com/unit-main.jpg", description: null, sortOrder: 0 },
          { url: "https://cdn.example.com/unit-2.jpg", description: "Salon", sortOrder: 1 },
        ],
        _count: { photos: 2 },
        updatedAt: new Date(),
      },
    ]);

    const { GET } = await import("@/app/api/public/catalog/route");
    const response = await GET(new NextRequest("http://localhost/api/public/catalog"));
    const json = await response.json();

    expect(json.items[0]).toMatchObject({
      imageUrl: "https://cdn.example.com/unit-main.jpg",
      photoCount: 3,
    });
  });

  it("renders a deduped gallery and exposes the photo count", () => {
    render(
      <ListingPhotoGallery
        title="Vue générale"
        unitPhotos={[
          { url: "https://cdn.example.com/a.jpg", description: "Vue A" },
          { url: "https://cdn.example.com/a.jpg", description: "Duplicate" },
          { url: "https://cdn.example.com/b.jpg", description: "Vue B" },
        ]}
        buildingPhotos={[
          { url: "https://cdn.example.com/c.jpg", description: "Vue C" },
        ]}
      />,
    );

    expect(screen.getAllByAltText("Vue A").length).toBeGreaterThan(0);
    expect(screen.getByText((content) => content.includes("1") && content.includes("3"))).toBeTruthy();
  });
});

describe("admin redirect", () => {
  it("redirects the legacy properties route to the new admin page", async () => {
    const { redirect } = await import("next/navigation");
    const page = await import("@/app/(private)/properties/page");
    await page.default();
    expect(redirect).toHaveBeenCalledWith("/admin/logements");
  });
});
