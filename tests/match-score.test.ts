import { describe, expect, it } from "vitest";
import { calculateMatchScore } from "@/lib/match-score";

describe("match scoring", () => {
  it("calcule un score de correspondance sur 100", () => {
    const result = calculateMatchScore({
      prospect: {
        maxBudget: 1400,
        preferredDistricts: ["Limoilou"],
        bedroomsNeeded: 2,
        moveInDate: new Date("2026-08-01"),
        hasPets: true,
        needsParking: true,
      },
      property: {
        monthlyPrice: 1300,
        district: "Limoilou",
        bedrooms: 2,
        availableFrom: new Date("2026-07-25"),
        petsAllowed: true,
        parking: true,
      },
    });

    expect(result.score).toBe(100);
    expect(result.reasons).toHaveLength(6);
  });
});
