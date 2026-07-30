export function formatPublicAddress(address: string) {
  const normalized = address
    .replace(/^\d+\s+/, "")
    .replace(/\b#\d+\b/gi, "")
    .replace(/\bapt\.?\s*\d+\b/gi, "")
    .replace(/\bappart\.?\s*\d+\b/gi, "")
    .replace(/\bunit(?:e)?\s*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized
    .replace(/^(rue|avenue|boulevard|chemin|place|allée|route|rang|st|street|blvd|ave)\b/i, (match) => `${match.charAt(0).toUpperCase()}${match.slice(1).toLowerCase()}`)
    .replace(/#\d+\b/gi, "")
    .replace(/[,;]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function getPublicFeatures(input: { petsAllowed?: boolean; parking?: boolean; inclusions?: string | null; washerDryer?: boolean; airConditioning?: boolean; storage?: boolean }) {
  const features: string[] = [];
  if (input.petsAllowed) features.push("Chat accepté");
  if (input.parking) features.push("Stationnement inclus");
  if (input.washerDryer || /laveuse|sécheuse|secheuse/i.test(input.inclusions ?? "")) features.push("Laveuse et sécheuse");
  if (input.airConditioning) features.push("Climatisation");
  if (input.storage) features.push("Rangement");
  if (input.inclusions) {
    const cleaned = input.inclusions.replace(/\s+/g, " ").trim();
    if (cleaned) features.push(cleaned);
  }
  return features.slice(0, 6);
}

export function isPublicPropertyVisible(status: string) {
  return !["RENTED", "REMOVED", "ARCHIVED"].includes(status);
}

export function getPublicVisibilityForRentalUnit(input: { status: string; isPubliclyVisible?: boolean | null }) {
  if (input.isPubliclyVisible === false) {
    return false;
  }
  return isPublicPropertyVisible(input.status);
}

export function hasMinimumPublicListingData(input: {
  address?: string | null;
  city?: string | null;
  monthlyPrice?: number | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  description?: string | null;
}) {
  return Boolean(
    input.address?.trim() &&
    input.city?.trim() &&
    (input.monthlyPrice ?? 0) > 0 &&
    input.propertyType?.trim() &&
    (input.bedrooms ?? -1) >= 0 &&
    input.description?.trim(),
  );
}

export function isRentalUnitPubliclyAvailable(input: {
  status: string;
  isPubliclyVisible?: boolean | null;
  address?: string | null;
  city?: string | null;
  monthlyPrice?: number | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  description?: string | null;
}) {
  if (input.isPubliclyVisible === false) {
    return false;
  }
  if (input.status !== "AVAILABLE") {
    return false;
  }
  if (!isPublicPropertyVisible(input.status)) {
    return false;
  }
  return hasMinimumPublicListingData(input);
}

export function isPropertyPubliclyAvailable(input: {
  status: string;
  address?: string | null;
  city?: string | null;
  monthlyPrice?: number | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  description?: string | null;
}) {
  if (input.status !== "AVAILABLE") {
    return false;
  }
  if (!isPublicPropertyVisible(input.status)) {
    return false;
  }
  return hasMinimumPublicListingData(input);
}

export type ListingPhotoCategory = "UNIT" | "BUILDING" | "COMMON" | "STAGED" | "PLAN" | "UNKNOWN";

export type ListingPhoto = {
  url: string;
  description?: string | null;
  category?: ListingPhotoCategory | null;
};

export function dedupeListingPhotos<T extends ListingPhoto>(photos: T[]) {
  const normalized = photos
    .filter((photo) => Boolean(photo?.url))
    .map((photo) => ({
      ...photo,
      url: photo.url.trim(),
      description: photo.description?.trim() || null,
      category: photo.category || "UNKNOWN",
    }))
    .filter((photo) => Boolean(photo.url));

  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const photo of normalized) {
    const normalizedUrl = photo.url.toLowerCase();
    if (seen.has(normalizedUrl)) {
      continue;
    }
    seen.add(normalizedUrl);
    deduped.push(photo);
  }

  return deduped;
}
