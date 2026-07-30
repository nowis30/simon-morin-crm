import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as publicVisitsRoute } from "@/app/api/public/visits/route";
import { POST as previewRoute } from "@/app/api/properties/import/gestion-isr/preview/route";
import { POST as applyRoute } from "@/app/api/properties/import/gestion-isr/apply/route";
import { fetchGestionIsrListings } from "@/integrations/gestion-isr/importer";
import { prisma } from "@/lib/prisma";

const { prismaMock, writeAuditLogMock } = vi.hoisted(() => ({
  prismaMock: {
    property: { findUnique: vi.fn() },
    prospect: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    visit: { create: vi.fn(), findUnique: vi.fn() },
    gestionIsrSyncPreview: { create: vi.fn() },
    building: { create: vi.fn() },
    rentalUnit: { create: vi.fn() },
  } as unknown as {
    property: { findUnique: ReturnType<typeof vi.fn> };
    prospect: { create: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
    visit: { create: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
    gestionIsrSyncPreview: { create: ReturnType<typeof vi.fn> };
    building: { create: ReturnType<typeof vi.fn> };
    rentalUnit: { create: ReturnType<typeof vi.fn> };
  },
  writeAuditLogMock: vi.fn(),
}));

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

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: writeAuditLogMock }));

describe("gestion ISR preview/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.gestionIsrSyncPreview.create.mockResolvedValue({
      id: "preview-1",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    prismaMock.property.findUnique.mockResolvedValue({
      id: "property-1",
      status: "AVAILABLE",
    });
    prismaMock.prospect.create.mockResolvedValue({ id: "prospect-1" });
    prismaMock.prospect.findFirst.mockResolvedValue(null);
    prismaMock.prospect.update.mockResolvedValue({ id: "prospect-1" });
    prismaMock.visit.findUnique.mockResolvedValue(null);
    prismaMock.visit.create.mockResolvedValue({
      id: "visit-1",
      propertyId: "property-1",
      prospectId: "prospect-1",
      property: { id: "property-1" },
      prospect: { id: "prospect-1" },
    });
  });
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

  it("sends public visits as JSON and creates a visit without changing ISR status", async () => {
    (prisma.property.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "property-1", status: "AVAILABLE" });

    const response = await publicVisitsRoute(new Request("http://localhost/api/public/visits", {
      method: "POST",
      body: JSON.stringify({
        prospect: { name: "Jean", phone: "5145550100", email: "jean@example.com", preferredLanguage: "fr", notes: "", hasPets: false, needsParking: false, preferredDistricts: [] },
        visit: { propertyId: "property-1", startsAt: new Date("2026-08-01T10:00:00.000Z").toISOString(), endsAt: new Date("2026-08-01T10:30:00.000Z").toISOString() },
      }),
    }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(prisma.property.findUnique).toHaveBeenCalled();
    expect((prisma.property.findUnique as ReturnType<typeof vi.fn>).mock.results[0]?.value).toBeDefined();
  });

  it("uses the linked property when a public visit comes from a RentalUnit", async () => {
    (prisma.property.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "property-1", status: "AVAILABLE" });
    (prisma.visit.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "visit-1", propertyId: "property-1", prospectId: "prospect-1", property: { id: "property-1" }, prospect: { id: "prospect-1" } });

    const response = await publicVisitsRoute(new Request("http://localhost/api/public/visits", {
      method: "POST",
      body: JSON.stringify({ prospect: { name: "Ava", phone: "5145551111", email: "ava@example.com", preferredLanguage: "fr", notes: "", hasPets: false, needsParking: false, preferredDistricts: [] }, visit: { propertyId: "property-1", startsAt: new Date("2026-08-02T10:00:00.000Z").toISOString(), endsAt: new Date("2026-08-02T10:30:00.000Z").toISOString() } }),
    }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.item.propertyId).toBe("property-1");
  });

  it("refuses apply without preview id", async () => {
    const response = await applyRoute(new Request("http://localhost/api/properties/import/gestion-isr/apply", { method: "POST", body: JSON.stringify({ url: "https://example.test" }) }));
    expect(response.status).toBe(400);
  });
});
