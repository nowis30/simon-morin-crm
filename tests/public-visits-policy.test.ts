import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/public/visits/route";

const { prismaMock, auditMock } = vi.hoisted(() => ({
  prismaMock: {
    property: { findUnique: vi.fn() },
    prospect: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    visit: { findUnique: vi.fn(), create: vi.fn() },
  },
  auditMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: auditMock }));

describe("public visit policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.property.findUnique.mockResolvedValue({ id: "property-1", status: "AVAILABLE" });
    prismaMock.prospect.findFirst.mockResolvedValue(null);
    prismaMock.prospect.create.mockResolvedValue({ id: "prospect-1" });
    prismaMock.visit.findUnique.mockResolvedValue(null);
    prismaMock.visit.create.mockResolvedValue({
      id: "visit-1",
      status: "PENDING_APPROVAL",
      propertyId: "property-1",
      prospectId: "prospect-1",
    });
  });

  it("creates a PENDING_APPROVAL visit from public source without modifying property status", async () => {
    const response = await POST(
      new Request("http://localhost/api/public/visits", {
        method: "POST",
        body: JSON.stringify({
          prospect: {
            name: "Julie Parent",
            phone: "514-555-0101",
            email: "julie@example.com",
            preferredLanguage: "fr",
            moveInDate: "2026-09-01T00:00:00.000Z",
            occupantsCount: 2,
            maxBudget: 1800,
            bedroomsNeeded: 2,
            hasPets: true,
            needsParking: true,
            availabilityNotes: "Lundi soir",
            notes: "Message test",
            preferredDistricts: ["Centre"],
          },
          visit: {
            propertyId: "property-1",
            rentalUnitId: "unit-1",
            startsAt: "2026-09-10T22:00:00.000Z",
            endsAt: "2026-09-10T22:30:00.000Z",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(prismaMock.visit.create).toHaveBeenCalled();
    expect(prismaMock.visit.create.mock.calls[0][0].data.status).toBe("PENDING_APPROVAL");
    expect(prismaMock.visit.create.mock.calls[0][0].data.internalNotes).toContain("SITE_PUBLIC");
    expect(auditMock).toHaveBeenCalled();
  });

  it("prevents duplicate submissions with idempotency", async () => {
    prismaMock.prospect.findFirst.mockResolvedValue({ id: "prospect-1", firstContactPropertyId: "property-1" });
    prismaMock.prospect.update.mockResolvedValue({ id: "prospect-1" });
    prismaMock.visit.findUnique.mockResolvedValue({ id: "visit-existing", status: "PENDING_APPROVAL" });

    const response = await POST(
      new Request("http://localhost/api/public/visits", {
        method: "POST",
        body: JSON.stringify({
          prospect: {
            name: "Julie Parent",
            phone: "514-555-0101",
            email: "julie@example.com",
            preferredLanguage: "fr",
            occupantsCount: 2,
            bedroomsNeeded: 2,
            hasPets: false,
            needsParking: false,
            preferredDistricts: [],
          },
          visit: {
            propertyId: "property-1",
            startsAt: "2026-09-10T22:00:00.000Z",
            endsAt: "2026-09-10T22:30:00.000Z",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.duplicate).toBe(true);
    expect(prismaMock.visit.create).not.toHaveBeenCalled();
  });
});
