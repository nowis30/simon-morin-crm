import crypto from "node:crypto";
import * as cheerio from "cheerio";

export type GestionIsrListing = {
  codeIsr: string;
  address: string;
  city: string;
  district?: string;
  monthlyPrice: number;
  bedrooms: number;
  propertyType: string;
  descriptionFr: string;
  listingUrl?: string;
  photoUrls: string[];
  sourceId?: string;
  buildingId?: string;
  unitId?: string;
  sourceStatus?: string;
  statusLabel?: string;
  unitNumber?: string;
  floor?: string;
  availableFrom?: string;
  petsAllowed?: boolean;
  petsDetails?: string;
  parkingCount?: number;
  parkingDetails?: string;
  washerDryer?: boolean;
  storage?: boolean;
  airConditioning?: boolean;
  inclusions?: string;
  rawRecord?: GestionIsrSupabaseRecord;
};

export type GestionIsrManagedProperty = {
  codeIsr: string;
  gestionIsrUrl: string | null;
  status: string;
};

export type GestionIsrSupabaseUnit = {
  id?: string;
  numero?: string;
  prix?: number;
  type?: string;
  etage?: string;
  statut?: string;
  chambres?: number;
  stationnement?: number;
  caract?: string;
  carac?: {
    rue?: string;
    animaux?: string;
    extras?: string[];
    laveuse?: string;
    rangement?: string;
    clim?: string;
  };
};

export type GestionIsrSupabaseRecord = {
  pk?: string;
  id?: string;
  titre?: string;
  ville?: string;
  secteur?: string;
  grandeur?: string;
  etage?: string;
  loyer?: number;
  date_dispo_affichage?: string;
  description?: string;
  photos?: string[];
  staged_photos?: string[];
  main_photo?: string;
  photo_variants?: Array<string | { main?: string; label?: string; photos?: string[] }> | null;
  id_app?: string;
  animaux?: string | null;
  stationnement?: number | null;
  units?: GestionIsrSupabaseUnit[] | null;
};

function clean(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function parsePrice(text: string) {
  const match = text.replace(/\s/g, "").match(/(\d{3,5})\$/);
  if (!match) {
    return 0;
  }
  return Number(match[1]);
}

function parseBedrooms(text: string) {
  const normalized = text.toLowerCase();
  const match = normalized.match(/(\d+)\s*(ch|chambre|bed)/);
  if (!match) {
    return 0;
  }
  return Number(match[1]);
}

function parseCode(text: string, fallbackSeed: string) {
  const direct =
    text.match(/code\s*isr\s*[:#-]?\s*([a-z0-9-]+)/i)?.[1] ||
    text.match(/isr\s*[:#-]?\s*([a-z0-9-]+)/i)?.[1];
  if (direct) {
    return `ISR-${direct.toUpperCase()}`;
  }
  const hash = crypto.createHash("sha1").update(fallbackSeed).digest("hex").slice(0, 10).toUpperCase();
  return `ISR-${hash}`;
}

function parseCityAndDistrict(text: string) {
  const parts = clean(text).split(",").map((part) => clean(part)).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[parts.length - 2], district: parts[parts.length - 1] };
  }
  if (parts.length === 1) {
    return { city: parts[0], district: "" };
  }
  return { city: "", district: "" };
}

function parseAddressFromText(text: string) {
  const markerLine = text.match(/📍\s*([^\n]+)/u)?.[1] || text.match(/📍\s*([^—]+)(?:—|$)/u)?.[1];
  const value = clean(markerLine || text)
    .replace(/^📍\s*/u, "")
    .replace(/—\s*Disponible.*$/iu, "")
    .replace(/Disponible.*$/iu, "")
    .replace(/^Plusieurs disponibilit[eé]s\s*!/iu, "")
    .trim();

  if (!value) {
    return "Adresse a verifier";
  }

  return value;
}

function parsePetsAllowed(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("aucun") || normalized.includes("non")) {
    return false;
  }
  return normalized.includes("chat") || normalized.includes("chien") || normalized.includes("animal");
}

export function inferGestionIsrMetadata(description: string) {
  const normalized = description.toLowerCase();
  const parking = /stationnement|garage|parking/.test(normalized);
  const petsAllowed = parsePetsAllowed(description);
  const petsDetailsMatch = description.match(/🐾\s*([^\n]+)/u) || description.match(/animaux\s*[:\-]?\s*([^\n]+)/iu);
  const inclusions: string[] = [];

  for (const token of [
    "Thermopompe",
    "Air climatisé",
    "Entrée laveuse et sécheuse",
    "Stationnement déneigé",
    "Aspirateur central",
    "Plancher chauffant",
    "Espace balcon",
    "Cabanon extérieur",
    "Internet inclus",
  ]) {
    if (normalized.includes(token.toLowerCase())) {
      inclusions.push(token);
    }
  }

  return {
    petsAllowed,
    petsDetails: clean(petsDetailsMatch?.[1] || ""),
    parking,
    inclusions: inclusions.join(", "),
  };
}

function toPhotoList(record: GestionIsrSupabaseRecord) {
  const variantPhotos = (record.photo_variants ?? []).flatMap((variant) => {
    if (typeof variant === "string") {
      return [variant];
    }

    return [variant.main, ...(variant.photos ?? [])].filter(Boolean) as string[];
  });

  const photos = [
    record.main_photo,
    ...(record.photos ?? []),
    ...(record.staged_photos ?? []),
    ...variantPhotos,
  ].filter(Boolean) as string[];
  return Array.from(new Set(photos));
}

function discoverSupabaseConfig(html: string) {
  const supabaseUrl = html.match(/const\s+SUPABASE_URL\s*=\s*'([^']+)'/)?.[1] ?? "";
  const supabaseAnon = html.match(/const\s+SUPABASE_ANON\s*=\s*'([^']+)'/)?.[1] ?? "";

  if (!supabaseUrl || !supabaseAnon) {
    return null;
  }

  return { supabaseUrl, supabaseAnon };
}

export function normalizeGestionIsrUnitStatus(rawStatus?: string) {
  const normalized = (rawStatus || "").trim();
  const lower = normalized.toLowerCase();
  if (!normalized) {
    return {
      normalizedStatus: "TO_VERIFY" as const,
      originalLabel: "",
      isPublishable: false,
      recommendedAction: "REVIEW",
    };
  }
  if (lower.includes("dispon") || lower.includes("available")) {
    return { normalizedStatus: "AVAILABLE" as const, originalLabel: normalized, isPublishable: true, recommendedAction: "PUBLISH" };
  }
  if (lower.includes("visite") || lower.includes("visit")) {
    return { normalizedStatus: "VISIT_SCHEDULED" as const, originalLabel: normalized, isPublishable: false, recommendedAction: "HIDE_FROM_LIST" };
  }
  if (lower.includes("reserve") || lower.includes("reserved")) {
    return { normalizedStatus: "RESERVED" as const, originalLabel: normalized, isPublishable: false, recommendedAction: "HIDE_FROM_LIST" };
  }
  if (lower.includes("lou") || lower.includes("rented") || lower.includes("occup")) {
    return { normalizedStatus: "RENTED" as const, originalLabel: normalized, isPublishable: false, recommendedAction: "HIDE" };
  }
  if (lower.includes("retir") || lower.includes("inact") || lower.includes("inactive")) {
    return { normalizedStatus: "REMOVED" as const, originalLabel: normalized, isPublishable: false, recommendedAction: "HIDE" };
  }
  return { normalizedStatus: "TO_VERIFY" as const, originalLabel: normalized, isPublishable: false, recommendedAction: "REVIEW" };
}

function normalizeStatus(rawStatus?: string) {
  return normalizeGestionIsrUnitStatus(rawStatus).normalizedStatus;
}

function shouldKeepUnit(unit: GestionIsrSupabaseUnit | undefined, record: GestionIsrSupabaseRecord) {
  const rawStatus = String(unit?.statut ?? record.titre ?? "").trim();
  const normalizedStatus = normalizeStatus(rawStatus);
  if (normalizedStatus === "RENTED" || normalizedStatus === "REMOVED") {
    return false;
  }
  return true;
}

function pickStableIdentity(record: GestionIsrSupabaseRecord, unit?: GestionIsrSupabaseUnit) {
  const buildingId = record.id_app || record.pk || record.id || null;
  const unitId = unit?.id || unit?.numero || unit?.etage || null;
  const seed = [buildingId, unitId, unit?.numero, record.titre].filter(Boolean).join("|");
  const hash = crypto.createHash("sha1").update(seed || JSON.stringify(record)).digest("hex").slice(0, 12).toUpperCase();
  return { buildingId, unitId, stableSeed: seed || hash, hash };
}

export function normalizeGestionIsrSupabaseListings(records: GestionIsrSupabaseRecord[], sourceUrl: string): GestionIsrListing[] {
  const listings: GestionIsrListing[] = [];

  for (const record of records) {
    const sharedPhotos = toPhotoList(record).slice(0, 20);
    const baseAddress =
      parseAddressFromText(record.units?.[0]?.carac?.rue || record.titre || record.id || record.description || "") ||
      clean(record.titre) ||
      "Adresse a verifier";
    const baseCity = clean(record.ville) || "Ville a verifier";
    const baseDistrict = clean(record.secteur) || "";
    const baseDescription = clean(record.description) || "Description a verifier";

    const units = record.units ?? [];
    const normalizedUnits = units.length > 0 ? units : [undefined];
    const relevantUnits = normalizedUnits.filter((unit) => shouldKeepUnit(unit, record));
    const chosenUnits = relevantUnits.length > 0 ? relevantUnits : [undefined];

    for (const unit of chosenUnits) {
      const identity = pickStableIdentity(record, unit);
      const address = parseAddressFromText(unit?.carac?.rue || baseAddress);
      const description = clean(unit?.caract) || baseDescription;
      const rawStatus = String(unit?.statut ?? record.titre ?? "").trim();
      const status = normalizeStatus(rawStatus);
      const titleSeed = `${identity.buildingId || baseAddress}-${identity.unitId || unit?.numero || unit?.etage || "unit"}`;
      const codeIsr = parseCode(titleSeed, titleSeed);

      listings.push({
        codeIsr,
        address: unit?.numero ? `${address} #${clean(unit.numero)}` : address,
        city: baseCity,
        district: baseDistrict,
        monthlyPrice: Number(unit?.prix || record.loyer || 0),
        bedrooms: Number(unit?.chambres ?? parseBedrooms(unit?.type || record.grandeur || description)),
        propertyType: clean(unit?.type || record.grandeur || "Appartement"),
        descriptionFr: description,
        listingUrl: sourceUrl,
        photoUrls: sharedPhotos,
        sourceId: identity.buildingId || undefined,
        buildingId: identity.buildingId || undefined,
        unitId: identity.unitId || undefined,
        sourceStatus: rawStatus || undefined,
        statusLabel: rawStatus || undefined,
        unitNumber: unit?.numero || undefined,
        floor: unit?.etage || undefined,
        availableFrom: undefined,
        petsAllowed: Boolean(unit?.carac?.animaux || record.animaux),
        petsDetails: clean(unit?.carac?.animaux || record.animaux || "") || undefined,
        parkingCount: unit?.stationnement ?? undefined,
        parkingDetails: unit?.stationnement ? `${unit.stationnement} stationnement${unit.stationnement > 1 ? "s" : ""}` : undefined,
        washerDryer: /laveuse|sécheuse|secheuse/i.test(description),
        storage: /rangement|cabanon|dépôt|depot/i.test(description),
        airConditioning: /clim|climatisation|thermopompe/i.test(description),
        inclusions: clean(unit?.carac?.extras?.join(", ") || record.description || "") || undefined,
        rawRecord: record,
      });
    }
  }

  const uniqueByCode = new Map<string, GestionIsrListing>();
  for (const listing of listings) {
    if (!listing.codeIsr || !listing.address || !listing.city || !listing.monthlyPrice) {
      continue;
    }
    uniqueByCode.set(listing.codeIsr, listing);
  }

  return Array.from(uniqueByCode.values());
}

export async function fetchGestionIsrRawRecords(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "SimonMorinAgentLocation/1.0 (+local-import)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Import Gestion ISR impossible (${response.status})`);
  }

  const html = await response.text();
  const config = discoverSupabaseConfig(html);
  if (!config) {
    return null;
  }

  const supabaseResponse = await fetch(`${config.supabaseUrl}/rest/v1/listings?select=*&statut=eq.Actif`, {
    headers: {
      apikey: config.supabaseAnon,
      Authorization: `Bearer ${config.supabaseAnon}`,
      Accept: "application/json",
    },
  });

  if (!supabaseResponse.ok) {
    throw new Error(`Source Supabase ISR inaccessible (${supabaseResponse.status})`);
  }

  const data = (await supabaseResponse.json()) as GestionIsrSupabaseRecord[];
  return data[0] ?? null;
}

async function fetchGestionIsrSupabaseListings(sourceUrl: string, html: string) {
  const config = discoverSupabaseConfig(html);
  if (!config) {
    return null;
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/listings?select=*&statut=eq.Actif`, {
    headers: {
      apikey: config.supabaseAnon,
      Authorization: `Bearer ${config.supabaseAnon}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Source Supabase ISR inaccessible (${response.status})`);
  }

  const data = (await response.json()) as GestionIsrSupabaseRecord[];
  return normalizeGestionIsrSupabaseListings(data, sourceUrl);
}

function extractCards($: cheerio.CheerioAPI) {
  const selectors = [
    "article",
    ".listing-item",
    ".property-item",
    ".card",
    "[data-listing-id]",
  ];

  for (const selector of selectors) {
    const found = $(selector);
    if (found.length >= 3) {
      return found;
    }
  }

  return $("body").children();
}

function getHost(url: string) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

export function selectGestionIsrCodesToRemove(input: {
  existingProperties: GestionIsrManagedProperty[];
  liveListings: GestionIsrListing[];
  sourceUrl: string;
}) {
  const sourceHost = getHost(input.sourceUrl);
  const liveCodes = new Set(input.liveListings.map((listing) => listing.codeIsr));

  return input.existingProperties
    .filter((property) => {
      if (!property.gestionIsrUrl) {
        return false;
      }

      const propertyHost = getHost(property.gestionIsrUrl);
      if (!propertyHost || propertyHost !== sourceHost) {
        return false;
      }

      if (["RENTED", "ARCHIVED"].includes(property.status)) {
        return false;
      }

      return !liveCodes.has(property.codeIsr);
    })
    .map((property) => property.codeIsr);
}

export async function fetchGestionIsrListings(url: string): Promise<GestionIsrListing[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "SimonMorinAgentLocation/1.0 (+local-import)",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Import Gestion ISR impossible (${response.status})`);
  }

  const html = await response.text();
  const supabaseListings = await fetchGestionIsrSupabaseListings(url, html);
  if (supabaseListings && supabaseListings.length > 0) {
    return supabaseListings;
  }

  const $ = cheerio.load(html);
  const cards = extractCards($);
  const listings: GestionIsrListing[] = [];

  cards.each((_index, element) => {
    const root = $(element);
    const text = clean(root.text());
    if (text.length < 20) {
      return;
    }

    const title = clean(root.find("h1, h2, h3, .title, .listing-title").first().text()) || text.slice(0, 120);
    const priceText = clean(root.find(".price, [class*='price']").first().text()) || text;
    const price = parsePrice(priceText);
    if (!price) {
      return;
    }

    const address = clean(root.find(".address, [class*='address']").first().text()) || title;
    const placeText = clean(root.find(".city, .location, [class*='location']").first().text()) || text;
    const { city, district } = parseCityAndDistrict(placeText);
    const bedrooms = parseBedrooms(text);
    const href = root.find("a").first().attr("href");
    const listingUrl = href ? new URL(href, url).toString() : url;

    const photoUrls: string[] = [];
    root.find("img").each((_i, img) => {
      const src = clean($(img).attr("src") || $(img).attr("data-src") || "");
      if (!src) {
        return;
      }
      try {
        photoUrls.push(new URL(src, url).toString());
      } catch {
        // Ignore les URLs invalides.
      }
    });

    const codeIsr = parseCode(text, `${listingUrl}|${address}|${price}`);

    listings.push({
      codeIsr,
      address,
      city: city || "Ville a verifier",
      district: district || "",
      monthlyPrice: price,
      bedrooms,
      propertyType: /studio/i.test(text) ? "Studio" : "Appartement",
      descriptionFr: text.slice(0, 2000),
      listingUrl,
      photoUrls: Array.from(new Set(photoUrls)).slice(0, 20),
    });
  });

  const uniqueByCode = new Map<string, GestionIsrListing>();
  for (const listing of listings) {
    if (!listing.codeIsr || !listing.address || !listing.city || !listing.monthlyPrice) {
      continue;
    }
    uniqueByCode.set(listing.codeIsr, listing);
  }

  return Array.from(uniqueByCode.values());
}
