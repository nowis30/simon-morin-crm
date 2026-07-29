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
