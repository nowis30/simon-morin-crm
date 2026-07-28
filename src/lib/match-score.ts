type MatchInput = {
  prospect: {
    maxBudget?: number | null;
    preferredDistricts: string[];
    bedroomsNeeded?: number | null;
    moveInDate?: Date | null;
    hasPets: boolean;
    needsParking: boolean;
  };
  property: {
    monthlyPrice: number;
    district?: string | null;
    bedrooms: number;
    availableFrom?: Date | null;
    petsAllowed: boolean;
    parking: boolean;
  };
};

export type MatchResult = {
  score: number;
  budgetCompatible: boolean;
  districtCompatible: boolean;
  bedroomsCompatible: boolean;
  dateCompatible: boolean;
  petsCompatible: boolean;
  parkingCompatible: boolean;
  reasons: string[];
};

export function calculateMatchScore(input: MatchInput): MatchResult {
  const { prospect, property } = input;

  const budgetCompatible = prospect.maxBudget ? property.monthlyPrice <= prospect.maxBudget : true;
  const districtCompatible =
    prospect.preferredDistricts.length > 0
      ? prospect.preferredDistricts.map((d) => d.toLowerCase()).includes((property.district ?? "").toLowerCase())
      : true;
  const bedroomsCompatible = prospect.bedroomsNeeded !== null && prospect.bedroomsNeeded !== undefined
    ? property.bedrooms >= prospect.bedroomsNeeded
    : true;

  const dateCompatible =
    prospect.moveInDate && property.availableFrom
      ? property.availableFrom.getTime() <= prospect.moveInDate.getTime() + 30 * 24 * 60 * 60 * 1000
      : true;
  const petsCompatible = prospect.hasPets ? property.petsAllowed : true;
  const parkingCompatible = prospect.needsParking ? property.parking : true;

  const points = [
    budgetCompatible ? 20 : 0,
    districtCompatible ? 20 : 0,
    bedroomsCompatible ? 20 : 0,
    dateCompatible ? 15 : 0,
    petsCompatible ? 15 : 0,
    parkingCompatible ? 10 : 0,
  ];

  const reasons = [
    `Budget compatible: ${budgetCompatible ? "oui" : "non"}`,
    `Bon secteur: ${districtCompatible ? "oui" : "non"}`,
    `Chambres compatibles: ${bedroomsCompatible ? "oui" : "non"}`,
    `Date compatible: ${dateCompatible ? "oui" : "non"}`,
    `Animaux compatibles: ${petsCompatible ? "oui" : "non"}`,
    `Stationnement compatible: ${parkingCompatible ? "oui" : "non"}`,
  ];

  return {
    score: Math.max(0, Math.min(100, points.reduce((a, b) => a + b, 0))),
    budgetCompatible,
    districtCompatible,
    bedroomsCompatible,
    dateCompatible,
    petsCompatible,
    parkingCompatible,
    reasons,
  };
}

export function createVisitWindow(startsAtIso: string) {
  const startsAt = new Date(startsAtIso);
  const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
  return { startsAt, endsAt, bufferMinutes: 30 };
}

export function defaultCommissionAmount() {
  return 500;
}

export function visitApprovalStatus(approved: boolean) {
  return approved ? "CONFIRMED" : "REFUSED";
}