import { createHash } from "crypto";
import JSZip from "jszip";
import { AdvertisementStatus } from "@prisma/client";
import { getPublicListingUrl } from "@/lib/public-url";
import { getPublicFeatures } from "@/lib/public-listings";
import { cleanText } from "@/lib/sanitize";

const MAX_SELECTED_PHOTOS = 20;
const MIN_SELECTED_PHOTOS = 1;
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_ZIP_SIZE_BYTES = 60 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

const PRIVATE_IP_V4_PREFIXES = [
  "10.",
  "127.",
  "169.254.",
  "192.168.",
] as const;

const TEXT_FILE_INSTRUCTIONS = [
  "1. Ouvrez Facebook Marketplace.",
  "2. Creez une nouvelle annonce de logement a louer.",
  "3. Televersez les photos dans leur ordre numerique.",
  "4. Copiez le texte de annonce-marketplace.txt.",
  "5. Verifiez le prix, la ville, la disponibilite et les conditions.",
  "6. Publiez seulement lorsque toutes les informations sont exactes.",
].join("\n");

export type MarketplacePhoto = {
  id: string;
  url: string;
  description: string | null;
  sortOrder: number;
};

export type MarketplacePreparationRecord = {
  advertisementId: string;
  advertisementStatus: AdvertisementStatus;
  title: string;
  body: string;
  property: {
    id: string;
    rentalUnitId: string | null;
    codeIsr: string;
    address: string;
    city: string;
    district: string | null;
    monthlyPrice: number;
    bedrooms: number;
    propertyType: string;
    petsAllowed: boolean;
    petsDetails: string | null;
    parking: boolean;
    inclusions: string | null;
    availableFrom: Date | null;
    status: string;
    photos: MarketplacePhoto[];
  };
  selectedPhotos: Array<{ propertyPhotoId: string; channel: string; sortOrder: number; isPrimary: boolean; excluded: boolean }>;
};

export type SanitizedMarketplacePhoto = {
  id: string;
  url: string;
  extension: "jpg" | "png" | "webp";
  isPrimary: boolean;
  order: number;
};

export function isPropertyAvailableForMarketplace(status: string) {
  return !["RENTED", "REMOVED", "TO_VERIFY", "ARCHIVED"].includes(status);
}

function extractPublicTitle(title: string, city: string) {
  const cleaned = cleanText(title)
    .replace(/\bISR[-\s]?[A-Z0-9-]+\b/gi, "")
    .replace(/\bcode\s*isr\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (cleaned) {
    return cleaned;
  }

  return `Logement disponible a ${city}`;
}

function formatAvailability(availableFrom: Date | null) {
  if (!availableFrom) {
    return "Disponible des maintenant";
  }
  return `Disponible des le ${availableFrom.toLocaleDateString("fr-CA")}`;
}

function getPublicListingId(input: { propertyId: string; rentalUnitId: string | null }) {
  return input.rentalUnitId ?? input.propertyId;
}

export function buildMarketplacePublicText(record: MarketplacePreparationRecord) {
  const property = record.property;
  const listingId = getPublicListingId({ propertyId: property.id, rentalUnitId: property.rentalUnitId });
  const publicUrl = getPublicListingUrl(listingId);
  const location = property.district ? `${property.city} - ${property.district}` : property.city;
  const publicTitle = extractPublicTitle(record.title, property.city);
  const animals = property.petsAllowed
    ? property.petsDetails?.trim() || "Animaux selon les conditions"
    : "Animaux non acceptes";

  const lines = [
    `🏠 ${publicTitle}`,
    "",
    `Prix : ${property.monthlyPrice.toLocaleString("fr-CA")} $ par mois`,
    "",
    `🛏️ ${property.bedrooms} chambre${property.bedrooms > 1 ? "s" : ""}`,
    `🏢 ${cleanText(property.propertyType)}`,
    `📍 ${location}`,
    `🚗 ${property.parking ? "Stationnement" : "Sans stationnement"}`,
    `🐾 ${animals}`,
    `📅 ${formatAvailability(property.availableFrom)}`,
  ];

  const features = getPublicFeatures({
    petsAllowed: property.petsAllowed,
    parking: property.parking,
    inclusions: property.inclusions,
  }).filter(Boolean);

  if (features.length > 0) {
    lines.push("", `Caracteristiques: ${features.join(" · ")}`);
  }

  lines.push(
    "",
    "Consultez toutes les photos et envoyez votre demande de visite :",
    "",
    publicUrl,
    "",
    "Simon Morin — Agent de location",
    "Telephone : 819-388-3407",
    "Courriel : simonmorin@nowis.store",
  );

  const text = lines.join("\n");

  const forbidden = [
    property.codeIsr,
    "ISR",
    property.address,
  ].filter(Boolean);

  const lowered = text.toLowerCase();
  if (forbidden.some((item) => lowered.includes(String(item).toLowerCase()) && String(item).trim().length > 6)) {
    throw new Error("Le texte public contient des donnees privees interdites.");
  }

  return {
    text,
    publicUrl,
  };
}

function isLikelyPrivateHost(hostname: string) {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".local")) return true;
  if (PRIVATE_IP_V4_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
  if (lower.startsWith("172.")) {
    const second = Number(lower.split(".")[1] || "0");
    if (second >= 16 && second <= 31) return true;
  }
  if (lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")) return true;
  return false;
}

function validateSafePhotoUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false as const, reason: "URL invalide" };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false as const, reason: "URL non securisee" };
  }

  if (isLikelyPrivateHost(parsed.hostname)) {
    return { ok: false as const, reason: "Hote prive ou local refuse" };
  }

  return { ok: true as const, url: parsed.toString() };
}

function getImageExtensionFromContentType(contentType: string | null, fallbackUrl: string) {
  const normalized = (contentType || "").toLowerCase();
  if (normalized.includes("image/jpeg") || normalized.includes("image/jpg")) return "jpg" as const;
  if (normalized.includes("image/png")) return "png" as const;
  if (normalized.includes("image/webp")) return "webp" as const;

  const lowerUrl = fallbackUrl.toLowerCase();
  if (lowerUrl.endsWith(".png")) return "png" as const;
  if (lowerUrl.endsWith(".webp")) return "webp" as const;
  return "jpg" as const;
}

function normalizeSelectedPhotos(record: MarketplacePreparationRecord, orderedPhotoIds: string[]) {
  const byId = new Map(record.property.photos.map((photo) => [photo.id, photo]));
  const seen = new Set<string>();
  const normalized: SanitizedMarketplacePhoto[] = [];

  const selectedFromOrder = orderedPhotoIds
    .map((id) => byId.get(id))
    .filter((photo): photo is MarketplacePhoto => Boolean(photo));

  const selectedFallback = record.selectedPhotos
    .filter((item) => item.channel === "MARKETPLACE" && !item.excluded)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)
    .map((item) => byId.get(item.propertyPhotoId))
    .filter((photo): photo is MarketplacePhoto => Boolean(photo));

  const source = selectedFromOrder.length > 0 ? selectedFromOrder : selectedFallback.length > 0 ? selectedFallback : record.property.photos;

  for (const photo of source) {
    if (seen.has(photo.id)) continue;
    const valid = validateSafePhotoUrl(photo.url);
    if (!valid.ok) continue;

    seen.add(photo.id);
    normalized.push({
      id: photo.id,
      url: valid.url,
      extension: "jpg",
      isPrimary: normalized.length === 0,
      order: normalized.length,
    });

    if (normalized.length >= MAX_SELECTED_PHOTOS) break;
  }

  return normalized;
}

async function fetchImageBuffer(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "image/jpeg,image/png,image/webp,*/*",
      },
      cache: "no-store",
    });

    if (response.status >= 300 && response.status < 400) {
      throw new Error("Redirection refusee");
    }

    if (!response.ok) {
      throw new Error("Image inaccessible");
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.toLowerCase().startsWith("image/")) {
      throw new Error("Type de fichier non image");
    }

    const contentLengthRaw = response.headers.get("content-length");
    if (contentLengthRaw) {
      const contentLength = Number(contentLengthRaw);
      if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE_BYTES) {
        throw new Error("Une photo depasse la taille permise.");
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("Une photo depasse la taille permise.");
    }

    return {
      buffer,
      extension: getImageExtensionFromContentType(contentType, url),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildZipFileName(listingId: string, date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `marketplace-logement-${listingId}-${yyyy}-${mm}-${dd}.zip`;
}

function textFingerprint(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export async function buildMarketplaceZipPackage(params: {
  record: MarketplacePreparationRecord;
  orderedPhotoIds: string[];
  finalText: string;
}) {
  const safeText = params.finalText.replace(/\r\n/g, "\n").trim();
  if (!safeText) {
    throw new Error("Le texte de l'annonce est vide.");
  }

  if (!isPropertyAvailableForMarketplace(params.record.property.status)) {
    throw new Error("Le logement n'est plus disponible.");
  }

  const selectedPhotos = normalizeSelectedPhotos(params.record, params.orderedPhotoIds);
  if (selectedPhotos.length < MIN_SELECTED_PHOTOS) {
    throw new Error("Aucune photo n'a ete selectionnee.");
  }

  const listingId = getPublicListingId({
    propertyId: params.record.property.id,
    rentalUnitId: params.record.property.rentalUnitId,
  });
  const publicUrl = getPublicListingUrl(listingId);
  const zip = new JSZip();

  let addedPhotoCount = 0;
  let totalPhotoBytes = 0;
  let hasPhotoWarning = false;

  for (let index = 0; index < selectedPhotos.length; index += 1) {
    const photo = selectedPhotos[index];
    try {
      const fetched = await fetchImageBuffer(photo.url);
      totalPhotoBytes += fetched.buffer.byteLength;
      if (totalPhotoBytes > MAX_ZIP_SIZE_BYTES) {
        throw new Error("Taille totale du kit depassee");
      }

      const position = String(index + 1).padStart(2, "0");
      const baseName = index === 0 ? `${position}-photo-principale` : `${position}-photo`;
      const fileName = `${baseName}.${fetched.extension}`;
      zip.file(fileName, fetched.buffer);
      addedPhotoCount += 1;
    } catch {
      hasPhotoWarning = true;
    }
  }

  zip.file("annonce-marketplace.txt", safeText);
  zip.file("lien-public.txt", publicUrl);
  zip.file("instructions.txt", TEXT_FILE_INSTRUCTIONS);

  const zipBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  if (zipBuffer.byteLength > MAX_ZIP_SIZE_BYTES) {
    throw new Error("Le kit Marketplace n'a pas pu etre cree.");
  }

  return {
    zipBuffer,
    fileName: buildZipFileName(listingId),
    publicUrl,
    addedPhotoCount,
    selectedPhotoCount: selectedPhotos.length,
    hasPhotoWarning,
    textFingerprint: textFingerprint(safeText),
  };
}
