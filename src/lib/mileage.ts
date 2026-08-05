import { env } from "@/lib/env";

export type DistanceResult = {
  oneWayKm: number;
  source: "GOOGLE_ROUTES" | "MANUAL";
};

export function roundKm(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateBusinessKm(oneWayKm: number, roundTrip: boolean) {
  return roundKm(oneWayKm * (roundTrip ? 2 : 1));
}

export function calculateVehicleSummary(input: {
  openingOdometerKm: number;
  closingOdometerKm: number;
  businessKm: number;
  vehicleExpenses: number;
  parkingAndTolls: number;
}) {
  const totalKm = Math.max(0, input.closingOdometerKm - input.openingOdometerKm);
  const businessUsePercent = totalKm > 0 ? Math.min(100, (input.businessKm / totalKm) * 100) : 0;
  const deductibleVehicleExpenses = input.vehicleExpenses * (businessUsePercent / 100);
  return {
    totalKm: roundKm(totalKm),
    businessUsePercent: Math.round(businessUsePercent * 100) / 100,
    deductibleVehicleExpenses: Math.round(deductibleVehicleExpenses * 100) / 100,
    estimatedTotalDeduction: Math.round((deductibleVehicleExpenses + input.parkingAndTolls) * 100) / 100,
  };
}

export async function calculateDrivingDistance(origin: string, destination: string): Promise<DistanceResult> {
  if (!env.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY_NOT_CONFIGURED");
  }

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { address: origin },
      destination: { address: destination },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      languageCode: "fr-CA",
      units: "METRIC",
    }),
  });

  if (!response.ok) {
    throw new Error("GOOGLE_ROUTES_FAILED");
  }

  const payload = (await response.json()) as { routes?: Array<{ distanceMeters?: number }> };
  const distanceMeters = payload.routes?.[0]?.distanceMeters;
  if (!distanceMeters || distanceMeters <= 0) {
    throw new Error("DISTANCE_NOT_FOUND");
  }

  return { oneWayKm: roundKm(distanceMeters / 1000), source: "GOOGLE_ROUTES" };
}
