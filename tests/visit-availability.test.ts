import { describe, expect, it } from "vitest";
import { generateAvailableSlots, getDefaultAvailabilitySettings } from "@/lib/visit-availability";

describe("visit availability", () => {
  const settings = getDefaultAvailabilitySettings();

  it("genere des plages selon l'horaire", () => {
    const slots = generateAvailableSlots({
      rangeStartIso: "2026-08-03T00:00:00.000Z",
      rangeEndIso: "2026-08-03T23:59:59.000Z",
      settings,
      nowIso: "2026-08-03T12:00:00.000Z",
      occupiedRanges: [],
      existingVisits: [],
      blockedRanges: [],
    });

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].timeZone).toBe("America/Toronto");
  });

  it("exclut les evenements occupes", () => {
    const slots = generateAvailableSlots({
      rangeStartIso: "2026-08-03T00:00:00.000Z",
      rangeEndIso: "2026-08-03T23:59:59.000Z",
      settings,
      nowIso: "2026-08-03T12:00:00.000Z",
      occupiedRanges: [{ startsAt: "2026-08-03T22:00:00.000Z", endsAt: "2026-08-03T22:30:00.000Z" }],
      existingVisits: [],
      blockedRanges: [],
    });

    expect(slots.some((slot) => slot.startsAt === "2026-08-03T22:00:00.000Z")).toBe(false);
  });

  it("applique le tampon de 30 minutes", () => {
    const slots = generateAvailableSlots({
      rangeStartIso: "2026-08-03T00:00:00.000Z",
      rangeEndIso: "2026-08-03T23:59:59.000Z",
      settings,
      nowIso: "2026-08-03T12:00:00.000Z",
      occupiedRanges: [],
      existingVisits: [{ startsAt: "2026-08-03T22:00:00.000Z", endsAt: "2026-08-03T22:30:00.000Z" }],
      blockedRanges: [],
    });

    expect(slots.some((slot) => slot.startsAt === "2026-08-03T22:30:00.000Z")).toBe(false);
  });

  it("exclut les periodes bloquees", () => {
    const slots = generateAvailableSlots({
      rangeStartIso: "2026-08-08T00:00:00.000Z",
      rangeEndIso: "2026-08-08T23:59:59.000Z",
      settings,
      nowIso: "2026-08-08T08:00:00.000Z",
      occupiedRanges: [],
      existingVisits: [],
      blockedRanges: [{ startsAt: "2026-08-08T14:00:00.000Z", endsAt: "2026-08-08T15:00:00.000Z" }],
    });

    expect(slots.some((slot) => slot.startsAt === "2026-08-08T14:00:00.000Z")).toBe(false);
  });

  it("exclut les heures passees", () => {
    const slots = generateAvailableSlots({
      rangeStartIso: "2026-08-03T00:00:00.000Z",
      rangeEndIso: "2026-08-03T23:59:59.000Z",
      settings,
      nowIso: "2026-08-03T23:00:00.000Z",
      occupiedRanges: [],
      existingVisits: [],
      blockedRanges: [],
    });

    expect(slots.length).toBe(0);
  });
});
