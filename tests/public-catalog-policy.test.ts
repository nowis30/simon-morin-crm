import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  rentalUnit: { findMany: vi.fn() },
  property: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

describe("public catalog policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only strictly available units and masks internal-only fields", async () => {
    mockPrisma.rentalUnit.findMany.mockResolvedValue([
      {
        id: "unit-public",
        codeIsr: "ISR-1",
        status: "AVAILABLE",
        isPubliclyVisible: true,
        monthlyPrice: 1450,
        bedrooms: 2,
        propertyType: "Appartement",
        description: "Beau logement",
        publicDescription: "Beau logement",
        petsAllowed: true,
        parking: true,
        inclusions: "Electros",
        unitNumber: "401",
        floor: "4",
        primaryPhotoUrl: "https://cdn.example.com/u1.jpg",
        building: {
          address: "123 rue des Lilas",
          city: "Drummondville",
          district: "Centre",
          name: "Le Lilas",
          photos: [{ url: "https://cdn.example.com/b1.jpg", description: null }],
        },
        photos: [{ url: "https://cdn.example.com/u1.jpg", description: null }],
      },
      {
        id: "unit-rented",
        codeIsr: "ISR-2",
        status: "RENTED",
        isPubliclyVisible: true,
        monthlyPrice: 1600,
        bedrooms: 2,
        propertyType: "Condo",
        description: "Indispo",
        publicDescription: "Indispo",
        petsAllowed: false,
        parking: false,
        inclusions: "",
        primaryPhotoUrl: null,
        building: { address: "99 rue X", city: "Drummondville", district: null, name: "X", photos: [] },
        photos: [],
      },
      {
        id: "unit-hidden",
        codeIsr: "ISR-3",
        status: "AVAILABLE",
        isPubliclyVisible: false,
        monthlyPrice: 1300,
        bedrooms: 1,
        propertyType: "Studio",
        description: "Cache",
        publicDescription: "Cache",
        petsAllowed: false,
        parking: false,
        inclusions: "",
        primaryPhotoUrl: null,
        building: { address: "55 rue Y", city: "Drummondville", district: null, name: "Y", photos: [] },
        photos: [],
      },
    ]);

    const { GET } = await import("@/app/api/public/catalog/route");
    const response = await GET();
    const json = await response.json();

    expect(json.items).toHaveLength(1);
    expect(json.items[0].city).toBe("Drummondville");
    expect(json.items[0].address).toBe("Rue des Lilas");
    expect(json.items[0].photoCount).toBe(2);
    expect(json.items[0].petsAllowed).toBe(true);
    expect(json.items[0].parking).toBe(true);
    expect(json.items[0].inclusions).toBe("Electros");
    expect(json.items[0].codeIsr).toBeUndefined();
    expect(json.items[0].rentalUnit).toBeUndefined();
    expect(json.items[0].building).toBeUndefined();
  });
});
