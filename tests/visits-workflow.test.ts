import { VisitStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildPendingVisitInput,
  buildVisitEventPayload,
  buildVisitMutationData,
  getGoogleModeWarning,
  isVisitRequestDuplicate,
  overlaps,
} from "@/lib/visits";

describe("visits workflow", () => {
  it("cree une demande en attente", () => {
    const input = buildPendingVisitInput({
      prospectId: "prospect-1",
      propertyId: "property-1",
      startsAtIso: "2026-08-08T14:00:00.000Z",
      endsAtIso: "2026-08-08T14:30:00.000Z",
      notes: "Visite de test",
    });

    expect(input.status).toBe(VisitStatus.PENDING_APPROVAL);
    expect(input.idempotencyKey).toBeTruthy();
    expect((input as { googleEventId?: string | null }).googleEventId ?? null).toBeNull();
  });

  it("detecte les doublons de demande", () => {
    const duplicate = isVisitRequestDuplicate(
      [{ prospectId: "p1", propertyId: "l1", startsAt: new Date("2026-08-08T14:00:00.000Z") }],
      { prospectId: "p1", propertyId: "l1", startsAtIso: "2026-08-08T14:00:00.000Z" },
    );

    expect(duplicate).toBe(true);
  });

  it("construit le contenu de l'evenement Google", () => {
    const payload = buildVisitEventPayload({
      startsAt: new Date("2026-08-08T14:00:00.000Z"),
      endsAt: new Date("2026-08-08T14:30:00.000Z"),
      notes: "Prospect tres interesse",
      prospect: {
        name: "Alice",
        phone: "555-1234",
        email: "alice@example.com",
        bedroomsNeeded: 2,
        maxBudget: 1500,
        hasPets: true,
        needsParking: true,
      },
      property: {
        codeIsr: "ISR-101",
        address: "123 Rue Test",
        city: "Quebec",
        district: "Limoilou",
      },
    });

    expect(payload.summary).toContain("Visite logement");
    expect(payload.description).toContain("Code ISR: ISR-101");
    expect(payload.location).toContain("123 Rue Test");
  });

  it("produit un message clair en mode sans Google", () => {
    const warning = getGoogleModeWarning("NO_GOOGLE");
    expect(warning).toContain("Mode sans Google");
  });

  it("prepare une modification de visite", () => {
    const data = buildVisitMutationData("RESCHEDULE", {
      startsAt: "2026-08-08T15:00:00.000Z",
      endsAt: "2026-08-08T15:30:00.000Z",
      notes: "Nouvel horaire",
    });

    expect(data.startsAt).toBeInstanceOf(Date);
    expect(data.endsAt).toBeInstanceOf(Date);
  });

  it("prepare une annulation de visite", () => {
    const data = buildVisitMutationData("CANCEL", { notes: "Annulee" });
    expect(data.status).toBe(VisitStatus.CANCELLED);
    expect(data.cancelledAt).toBeInstanceOf(Date);
  });

  it("refuse une plage devenue occupee selon chevauchement", () => {
    const conflict = overlaps(
      { startsAt: "2026-08-08T14:00:00.000Z", endsAt: "2026-08-08T14:30:00.000Z" },
      { startsAt: new Date("2026-08-08T14:15:00.000Z"), endsAt: new Date("2026-08-08T14:45:00.000Z") },
      30,
    );

    expect(conflict).toBe(true);
  });
});
