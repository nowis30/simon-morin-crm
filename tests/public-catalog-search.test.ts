import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    rentalUnit: { count: vi.fn(), findMany: vi.fn() },
    property: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("public catalog search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.rentalUnit.count.mockResolvedValue(1);
    prismaMock.property.count.mockResolvedValue(0);
    prismaMock.property.findMany.mockResolvedValue([]);
    prismaMock.rentalUnit.findMany.mockResolvedValue([
      {
        id: "unit-1",
        status: "AVAILABLE",
        isPubliclyVisible: true,
        monthlyPrice: 1500,
        bedrooms: 2,
        propertyType: "Appartement",
        publicTitle: "4 1/2 moderne",
        publicDescription: "Grand logement",
        description: "Grand logement",
        inclusions: "Electros",
        petsAllowed: true,
        parking: true,
        availableFrom: new Date("2026-09-01T00:00:00.000Z"),
        primaryPhotoUrl: null,
        building: {
          address: "123 rue Principale",
          city: "Drummondville",
          district: "Centre",
          photos: [{ url: "https://cdn.example.com/b1.jpg", description: null }],
          _count: { photos: 1 },
        },
        photos: [{ url: "https://cdn.example.com/u1.jpg", description: null }],
        _count: { photos: 1 },
        displayOrder: 1,
        updatedAt: new Date(),
      },
    ]);
  });

  it("filters by city", async () => {
    const { GET } = await import("@/app/api/public/catalog/route");
    await GET(new NextRequest("http://localhost/api/public/catalog?city=Drummondville"));

    const where = prismaMock.rentalUnit.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain("drummondville");
  });

  it("filters by district", async () => {
    const { GET } = await import("@/app/api/public/catalog/route");
    await GET(new NextRequest("http://localhost/api/public/catalog?district=Centre"));

    const where = prismaMock.rentalUnit.findMany.mock.calls[0][0].where;
    expect(JSON.stringify(where)).toContain("centre");
  });

  it("filters by bedrooms and max price", async () => {
    const { GET } = await import("@/app/api/public/catalog/route");
    await GET(new NextRequest("http://localhost/api/public/catalog?bedrooms=2&maxPrice=1600"));

    const where = prismaMock.rentalUnit.findMany.mock.calls[0][0].where;
    expect(where.bedrooms).toBe(2);
    expect(where.monthlyPrice.lte).toBe(1600);
  });

  it("filters by pets and parking", async () => {
    const { GET } = await import("@/app/api/public/catalog/route");
    await GET(new NextRequest("http://localhost/api/public/catalog?petsAllowed=true&parking=true"));

    const where = prismaMock.rentalUnit.findMany.mock.calls[0][0].where;
    expect(where.petsAllowed).toBe(true);
    expect(where.parking).toBe(true);
  });

  it("supports combined filters", async () => {
    const { GET } = await import("@/app/api/public/catalog/route");
    await GET(
      new NextRequest(
        "http://localhost/api/public/catalog?q=moderne&city=Drummondville&district=Centre&bedrooms=2&maxPrice=1700&propertyType=Appartement&petsAllowed=true&parking=true",
      ),
    );

    const where = prismaMock.rentalUnit.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("AVAILABLE");
    expect(where.bedrooms).toBe(2);
    expect(where.monthlyPrice.lte).toBe(1700);
    expect(where.petsAllowed).toBe(true);
    expect(where.parking).toBe(true);
  });

  it("sorts by ascending and descending price", async () => {
    const { GET } = await import("@/app/api/public/catalog/route");
    await GET(new NextRequest("http://localhost/api/public/catalog?sort=price_asc"));
    await GET(new NextRequest("http://localhost/api/public/catalog?sort=price_desc"));

    const firstOrder = prismaMock.rentalUnit.findMany.mock.calls[0][0].orderBy[0];
    const secondOrder = prismaMock.rentalUnit.findMany.mock.calls[1][0].orderBy[0];
    expect(firstOrder).toMatchObject({ monthlyPrice: "asc" });
    expect(secondOrder).toMatchObject({ monthlyPrice: "desc" });
  });

  it("supports pagination and can fetch the thirteenth listing", async () => {
    prismaMock.rentalUnit.count.mockResolvedValue(13);
    prismaMock.rentalUnit.findMany.mockResolvedValueOnce([
      {
        id: "unit-13",
        status: "AVAILABLE",
        isPubliclyVisible: true,
        monthlyPrice: 1800,
        bedrooms: 3,
        propertyType: "Condo",
        publicDescription: "Disponible",
        description: "Disponible",
        inclusions: "",
        petsAllowed: false,
        parking: false,
        availableFrom: null,
        primaryPhotoUrl: null,
        building: { address: "130 rue Test", city: "Drummondville", district: null, photos: [], _count: { photos: 0 } },
        photos: [],
        _count: { photos: 0 },
        displayOrder: 1,
        updatedAt: new Date(),
      },
    ]);

    const { GET } = await import("@/app/api/public/catalog/route");
    const response = await GET(new NextRequest("http://localhost/api/public/catalog?page=2&pageSize=12"));
    const json = await response.json();

    expect(prismaMock.rentalUnit.findMany.mock.calls[0][0].skip).toBe(12);
    expect(prismaMock.rentalUnit.findMany.mock.calls[0][0].take).toBe(12);
    expect(json.items[0].id).toBe("unit-13");
    expect(json.totalPages).toBe(2);
  });

  it("keeps unavailable units excluded", async () => {
    prismaMock.rentalUnit.findMany.mockResolvedValueOnce([
      {
        id: "unit-hidden",
        status: "AVAILABLE",
        isPubliclyVisible: false,
        monthlyPrice: 1400,
        bedrooms: 1,
        propertyType: "Studio",
        publicDescription: "Cache",
        description: "Cache",
        inclusions: "",
        petsAllowed: false,
        parking: false,
        availableFrom: null,
        primaryPhotoUrl: null,
        building: { address: "80 rue Cachee", city: "Drummondville", district: null, photos: [], _count: { photos: 0 } },
        photos: [],
        _count: { photos: 0 },
        displayOrder: 1,
        updatedAt: new Date(),
      },
    ]);

    const { GET } = await import("@/app/api/public/catalog/route");
    const response = await GET(new NextRequest("http://localhost/api/public/catalog"));
    const json = await response.json();

    expect(json.items).toHaveLength(0);
  });

  it("always masks precise address details", async () => {
    const { GET } = await import("@/app/api/public/catalog/route");
    const response = await GET(new NextRequest("http://localhost/api/public/catalog"));
    const json = await response.json();

    expect(json.items[0].address).toBe("Rue Principale");
  });

  it("corrects invalid parameters to safe defaults", async () => {
    const { GET } = await import("@/app/api/public/catalog/route");
    const response = await GET(new NextRequest("http://localhost/api/public/catalog?page=-2&pageSize=500&bedrooms=notanumber"));
    const json = await response.json();

    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(24);
  });
});
