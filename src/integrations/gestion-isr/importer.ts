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
};

export type GestionIsrManagedProperty = {
  codeIsr: string;
  gestionIsrUrl: string | null;
  status: string;
};

type GestionIsrSupabaseUnit = {
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

type GestionIsrSupabaseRecord = {
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

    const availableUnits = (record.units ?? []).filter((unit) => String(unit.statut ?? "").toLowerCase().includes("dispon"));

    if (availableUnits.length > 0) {
      for (const unit of availableUnits) {
        const titleSeed = `${record.id_app || record.pk || record.id || baseAddress}-${unit.id || unit.numero || unit.etage || unit.type || 'unit'}`;
        const address = parseAddressFromText(unit.carac?.rue || baseAddress);
        const description = clean(unit.caract) || baseDescription;
        listings.push({
          codeIsr: parseCode(titleSeed, titleSeed),
          address: unit.numero ? `${address} #${clean(unit.numero)}` : address,
          city: baseCity,
          district: baseDistrict,
          monthlyPrice: Number(unit.prix || record.loyer || 0),
          bedrooms: Number(unit.chambres ?? parseBedrooms(unit.type || record.grandeur || description)),
          propertyType: clean(unit.type || record.grandeur || "Appartement"),
          descriptionFr: description,
          listingUrl: sourceUrl,
          photoUrls: sharedPhotos,
        });
      }
      continue;
    }

    const codeSeed = `${record.id_app || record.pk || record.id || baseAddress}-${record.titre || "listing"}`;
    listings.push({
      codeIsr: parseCode(codeSeed, codeSeed),
      address: baseAddress,
      city: baseCity,
      district: baseDistrict,
      monthlyPrice: Number(record.loyer || 0),
      bedrooms: parseBedrooms(record.grandeur || baseDescription),
      propertyType: clean(record.grandeur || "Appartement"),
      descriptionFr: baseDescription,
      listingUrl: sourceUrl,
      photoUrls: sharedPhotos,
    });
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
