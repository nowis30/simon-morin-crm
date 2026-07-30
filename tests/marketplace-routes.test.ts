import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockWriteAuditLog = vi.fn(async () => {});
const mockRequireApiUser = vi.fn(async () => ({ user: { id: "user-1" } }));
const mockValidateCsrf = vi.fn(async () => true);

const mockPrisma = {
  advertisement: {
    findUnique: vi.fn(),
    update: vi.fn(async () => {}),
  },
  advertisementPublication: {
    create: vi.fn(async () => ({ id: "pub-1" })),
  },
};

vi.mock("@/lib/audit", () => ({ writeAuditLog: mockWriteAuditLog }));
vi.mock("@/lib/route-guards", () => ({
  requireApiUser: mockRequireApiUser,
  safeServerError: () => new Response(JSON.stringify({ error: "Erreur serveur" }), { status: 500 }),
}));
vi.mock("@/lib/csrf", () => ({ validateCsrfRequest: mockValidateCsrf }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

function buildAd(status = "AVAILABLE") {
  return {
    id: "ad-1",
    title: "Titre",
    body: "Corps",
    status: "APPROVED",
    publicationUrl: null,
    property: {
      id: "property-1",
      rentalUnitId: "unit-1",
      codeIsr: "ISR-123",
      address: "123 Rue Lagace #315",
      city: "Drummondville",
      district: "Centre",
      monthlyPrice: 1750,
      bedrooms: 3,
      propertyType: "Appartement",
      petsAllowed: true,
      petsDetails: null,
      parking: true,
      inclusions: "Thermopompe",
      availableFrom: null,
      status,
      photos: [{ id: "p1", url: "https://cdn.example.com/1.jpg", description: null, sortOrder: 0 }],
    },
    selectedPhotos: [{ propertyPhotoId: "p1", channel: "MARKETPLACE", sortOrder: 0, isPrimary: true, excluded: false }],
  };
}

describe("marketplace package route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiUser.mockResolvedValue({ user: { id: "user-1" } });
    mockValidateCsrf.mockResolvedValue(true);
  });

  it("requires authenticated admin user", async () => {
    mockRequireApiUser.mockResolvedValue({ response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) } as any);
    const { POST } = await import("@/app/api/marketing/marketplace/[advertisementId]/package/route");

    const request = new NextRequest("http://localhost/api/marketing/marketplace/ad-1/package", {
      method: "POST",
      body: JSON.stringify({ orderedPhotoIds: ["p1"], finalText: "texte" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ advertisementId: "ad-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 404 when advertisement does not exist", async () => {
    mockPrisma.advertisement.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/marketing/marketplace/[advertisementId]/package/route");

    const request = new NextRequest("http://localhost/api/marketing/marketplace/ad-1/package", {
      method: "POST",
      body: JSON.stringify({ orderedPhotoIds: ["p1"], finalText: "texte" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ advertisementId: "ad-1" }) });
    expect(response.status).toBe(404);
  });

  it("returns error when property is not available", async () => {
    mockPrisma.advertisement.findUnique.mockResolvedValue(buildAd("RENTED"));
    const { POST } = await import("@/app/api/marketing/marketplace/[advertisementId]/package/route");

    const request = new NextRequest("http://localhost/api/marketing/marketplace/ad-1/package", {
      method: "POST",
      body: JSON.stringify({ orderedPhotoIds: ["p1"], finalText: "texte" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ advertisementId: "ad-1" }) });
    const payload = await response.json();
    expect(response.status).toBe(400);
    expect(payload.error).toBe("Le logement n'est plus disponible.");
  });

  it("creates a zip and does not mark advertisement as published", async () => {
    mockPrisma.advertisement.findUnique.mockResolvedValue(buildAd("AVAILABLE"));
    vi.stubGlobal("fetch", vi.fn(async () => {
      const bytes = new Uint8Array([255, 216, 255, 224]);
      return new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg", "content-length": String(bytes.byteLength) } });
    }));

    const { POST } = await import("@/app/api/marketing/marketplace/[advertisementId]/package/route");

    const request = new NextRequest("http://localhost/api/marketing/marketplace/ad-1/package", {
      method: "POST",
      body: JSON.stringify({ orderedPhotoIds: ["p1"], finalText: "texte" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ advertisementId: "ad-1" }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");

    expect(mockPrisma.advertisement.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "MANUAL_ACTION_REQUIRED",
        publicationChannel: "MARKETPLACE",
      }),
    }));
  });
});

describe("marketplace manual confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireApiUser.mockResolvedValue({ user: { id: "user-1" } });
    mockValidateCsrf.mockResolvedValue(true);
  });

  it("stores manual confirmation without requiring URL", async () => {
    mockPrisma.advertisement.findUnique.mockResolvedValue({ id: "ad-1", publicationUrl: null });
    const { POST } = await import("@/app/api/marketing/marketplace/[advertisementId]/manual-confirm/route");

    const request = new NextRequest("http://localhost/api/marketing/marketplace/ad-1/manual-confirm", {
      method: "POST",
      body: JSON.stringify({ notes: "Publie via mobile" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request, { params: Promise.resolve({ advertisementId: "ad-1" }) });
    expect(response.status).toBe(200);
    expect(mockPrisma.advertisementPublication.create).toHaveBeenCalled();
    expect(mockPrisma.advertisement.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "PUBLISHED",
        publicationChannel: "MARKETPLACE",
      }),
    }));
  });
});
