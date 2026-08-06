import { describe, expect, it } from "vitest";
import { calculateBusinessKm, calculateVehicleSummary } from "@/lib/mileage";

describe("mileage calculations", () => {
  it("doubles the distance for a round trip", () => {
    expect(calculateBusinessKm(12.35, true)).toBe(24.7);
    expect(calculateBusinessKm(12.35, false)).toBe(12.4);
  });

  it("applies business-use percentage to annual vehicle expenses", () => {
    expect(calculateVehicleSummary({
      openingOdometerKm: 10_000,
      closingOdometerKm: 20_000,
      businessKm: 4_000,
      vehicleExpenses: 5_000,
      parkingAndTolls: 125,
    })).toEqual({
      totalKm: 10_000,
      businessUsePercent: 40,
      deductibleVehicleExpenses: 2_000,
      estimatedTotalDeduction: 2_125,
    });
  });
});
