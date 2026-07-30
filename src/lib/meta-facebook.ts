import { randomBytes } from "crypto";
import { AdvertisementStatus } from "@prisma/client";
import { env, getMetaConfigIssues, isMetaConfigured } from "@/lib/env";
import { getPublicAppUrl, getPublicListingPath, getPublicListingUrl } from "@/lib/public-url";
import { getPublicFeatures } from "@/lib/public-listings";
import { prisma } from "@/lib/prisma";
import { decryptMetaToken, encryptMetaToken } from "@/lib/meta-token-crypto";
import { cleanText } from "@/lib/sanitize";

const GRAPH_API_VERSION = env.META_GRAPH_API_VERSION;
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const OAUTH_BASE = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const OAUTH_STATE_MAX_AGE_MS = OAUTH_STATE_MAX_AGE_SECONDS * 1000;
const MAX_PHOTOS_PER_PUBLICATION = 10;
const OFFICIAL_PUBLIC_PHONE = "819-388-3407";
const OFFICIAL_PUBLIC_EMAIL = "simonmorin@nowis.store";

const ALLOWED_FACEBOOK_PUBLICATION_HOSTS = [
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "fb.com",
  "www.fb.com",
] as const;

export const REQUIRED_META_SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts"] as const;

type MetaGraphError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

type MetaResponsePayload = {
  id?: string;
  post_id?: string;
  permalink_url?: string;
  error?: MetaGraphError;
};

type PublicationTarget = {
  listingId: string;
  listingPath: string;
  listingUrl: string;
};

export type ManualPublicationPayload = {
  message: string;
  listingUrl: string;
  facebookOpenUrl: string;
  photoUrls: string[];
  primaryPhotoUrl: string | null;
};

export type MetaDiagnosticResult = {
  configured: boolean;
  connected: boolean;
  pageIdMatches: boolean;
  pageName: string | null;
  tokenValid: boolean;
  grantedScopes: string[];
  missingScopes: string[];
  graphApiVersion: string;
  issues: string[];
  pageId: string | null;
  configIssues: string[];
  connectionExists: boolean;
  tokenExpiresAt: string | null;
  tokenRevoked: boolean;
  usingDefaultGraphApiVersion: boolean;
};

function parseMetaError(payload: unknown) {
  const base = (payload as MetaResponsePayload | undefined)?.error;
  if (!base) {
    return null;
  }

  const message = cleanText(base.message ?? "Echec Meta") || "Echec Meta";
  return {
    message,
    type: base.type ? cleanText(base.type) : undefined,
    code: typeof base.code === "number" ? base.code : undefined,
    subcode: typeof base.error_subcode === "number" ? base.error_subcode : undefined,
    traceId: base.fbtrace_id ? cleanText(base.fbtrace_id) : undefined,
  };
}

function formatMetaError(error: ReturnType<typeof parseMetaError>) {
  if (!error) {
    return "Erreur Meta inconnue";
  }

  if (error.code === 190) {
    return "Le jeton de Page Facebook est expire.";
  }

  if (error.message.toLowerCase().includes("permission") || error.code === 10) {
    return "La permission pages_manage_posts est absente.";
  }

  if (error.message.toLowerCase().includes("redirect_uri")) {
    return "L'adresse de redirection OAuth ne correspond pas.";
  }

  return error.message;
}

function buildMetaErrorDetails(error: ReturnType<typeof parseMetaError>) {
  if (!error) {
    return null;
  }

  return JSON.stringify({
    message: error.message,
    type: error.type ?? null,
    code: error.code ?? null,
    subcode: error.subcode ?? null,
    traceId: error.traceId ?? null,
  });
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function dedupePhotoUrls(photoUrls: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const url of photoUrls.map((item) => item.trim()).filter(Boolean)) {
    if (!isHttpUrl(url)) {
      continue;
    }

    const normalized = url.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(url);
    if (deduped.length >= MAX_PHOTOS_PER_PUBLICATION) {
      break;
    }
  }

  return deduped;
}

function buildFingerprint(title: string, message: string, photoUrls: string[]) {
  return `${title.trim()}|${message.trim()}|${photoUrls.join("|")}`.toLowerCase();
}

function extractPublicTitle(input: string) {
  const normalized = cleanText(input)
    .replace(/\b\d{1,6}\s+[^\n]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return normalized || "Logement disponible";
}

function formatAvailability(availableFrom: Date | null | undefined) {
  if (!availableFrom) {
    return "Disponibilite: a confirmer";
  }
  return `Disponibilite: ${availableFrom.toLocaleDateString("fr-CA")}`;
}

function buildPublicationTarget(property: { id: string; rentalUnitId: string | null }) {
  const listingId = property.rentalUnitId ?? property.id;
  return {
    listingId,
    listingPath: getPublicListingPath(listingId),
    listingUrl: getPublicListingUrl(listingId),
  } as PublicationTarget;
}

export function buildManualFacebookText(input: {
  title: string;
  property: {
    id: string;
    rentalUnitId: string | null;
    monthlyPrice: number;
    bedrooms: number;
    city: string;
    district: string | null;
    propertyType: string;
    petsAllowed: boolean;
    parking: boolean;
    inclusions: string | null;
    availableFrom: Date | null;
    address: string;
  };
}) {
  const target = buildPublicationTarget(input.property);
  const title = extractPublicTitle(input.title);
  const locationLabel = input.property.district ? `${input.property.city} - ${input.property.district}` : input.property.city;

  const features = getPublicFeatures({
    petsAllowed: input.property.petsAllowed,
    parking: input.property.parking,
    inclusions: input.property.inclusions,
  }).slice(0, 4);

  const lines = [
    `🏠 ${title}`,
    "",
    `${input.property.monthlyPrice.toLocaleString("fr-CA")} $ / mois`,
    `${input.property.bedrooms} chambre${input.property.bedrooms > 1 ? "s" : ""}`,
    locationLabel,
    `Type: ${cleanText(input.property.propertyType)}`,
    `Animaux: ${input.property.petsAllowed ? "acceptes" : "non acceptes"}`,
    `Stationnement: ${input.property.parking ? "inclus" : "non inclus"}`,
    formatAvailability(input.property.availableFrom),
    features.length > 0 ? `Caracteristiques: ${features.join(" · ")}` : null,
    "",
    "Consultez toutes les photos et envoyez votre demande de visite :",
    "",
    target.listingUrl,
    "",
    "Simon Morin — Agent de location",
    `Telephone: ${OFFICIAL_PUBLIC_PHONE}`,
    `Courriel: ${OFFICIAL_PUBLIC_EMAIL}`,
  ].filter(Boolean);

  const fullText = lines.join("\n");
  const fullAddress = cleanText(input.property.address);
  if (fullAddress && fullText.toLowerCase().includes(fullAddress.toLowerCase())) {
    throw new Error("Le texte public contient une adresse privee complete.");
  }

  return {
    ...target,
    message: fullText,
  };
}

function buildManualFacebookOpenUrl(target: PublicationTarget) {
  const pageUrl = env.META_PAGE_URL?.trim();
  if (pageUrl && isHttpUrl(pageUrl)) {
    return pageUrl;
  }

  const share = new URL("https://www.facebook.com/sharer/sharer.php");
  share.searchParams.set("u", target.listingUrl);
  return share.toString();
}

function ensureRequiredMetaConfig() {
  const issues: string[] = [];
  if (!env.META_APP_ID) issues.push("META_APP_ID manquant");
  if (!env.META_APP_SECRET) issues.push("META_APP_SECRET manquant");
  if (!env.META_REDIRECT_URI) issues.push("META_REDIRECT_URI manquant");
  if (!env.META_PAGE_ID) issues.push("META_PAGE_ID manquant");
  if (!env.META_TOKEN_ENCRYPTION_KEY) issues.push("META_TOKEN_ENCRYPTION_KEY manquant");
  return issues;
}

export function validateFacebookPublicationUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (!ALLOWED_FACEBOOK_PUBLICATION_HOSTS.includes(parsed.hostname as (typeof ALLOWED_FACEBOOK_PUBLICATION_HOSTS)[number])) {
    return false;
  }

  return parsed.protocol === "https:";
}

export function createMetaState(userId: string) {
  return `${userId}:${randomBytes(12).toString("hex")}:${Date.now()}`;
}

export function isMetaStateValid(params: { state: string; expectedState: string; userId: string }) {
  if (!params.state || !params.expectedState || params.state !== params.expectedState) {
    return false;
  }

  const parts = params.state.split(":");
  if (parts.length !== 3) {
    return false;
  }

  const [stateUserId, , issuedAtRaw] = parts;
  const issuedAt = Number(issuedAtRaw);
  if (!stateUserId || stateUserId !== params.userId || !Number.isFinite(issuedAt)) {
    return false;
  }

  return Date.now() - issuedAt <= OAUTH_STATE_MAX_AGE_MS;
}

export function createMetaOAuthUrl(state: string) {
  if (!env.META_APP_ID || !env.META_REDIRECT_URI) {
    throw new Error("Configuration OAuth Meta incomplete");
  }

  const query = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: env.META_REDIRECT_URI,
    state,
    response_type: "code",
    scope: REQUIRED_META_SCOPES.join(","),
  });

  return `${OAUTH_BASE}?${query.toString()}`;
}

async function fetchMetaJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as T & MetaResponsePayload;
  return { response, payload };
}

export async function exchangeMetaCodeForToken(code: string) {
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI) {
    throw new Error("Configuration OAuth Meta incomplete");
  }

  const query = new URLSearchParams({
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: env.META_REDIRECT_URI,
    code,
  });

  const { response, payload } = await fetchMetaJson<{ access_token?: string }>(`${GRAPH_BASE}/oauth/access_token?${query.toString()}`);

  if (!response.ok || !payload.access_token) {
    const error = parseMetaError(payload);
    throw new Error(formatMetaError(error) || "Echec OAuth Meta");
  }

  return payload.access_token;
}

async function fetchPageTokenFromUserToken(userToken: string) {
  if (!env.META_PAGE_ID) {
    throw new Error("META_PAGE_ID manquant");
  }

  const query = new URLSearchParams({ access_token: userToken, fields: "id,name,access_token" });
  const { response, payload } = await fetchMetaJson<{ data?: Array<{ id: string; name: string; access_token: string }> }>(`${GRAPH_BASE}/me/accounts?${query.toString()}`);

  if (!response.ok) {
    const error = parseMetaError(payload);
    throw new Error(formatMetaError(error) || "Impossible de recuperer les pages Meta");
  }

  const page = (payload.data ?? []).find((item) => item.id === env.META_PAGE_ID);
  if (!page?.access_token) {
    throw new Error("La Page Facebook configuree n'est pas accessible avec ce compte. Verifiez que Simon possede un acces complet a la Page et reconnectez Facebook.");
  }

  return { pageName: page.name, pageToken: page.access_token };
}

export async function upsertMetaConnectionFromToken(params: { userId: string; pageToken: string; pageName?: string | null; userToken?: string | null }) {
  if (!env.META_PAGE_ID) {
    throw new Error("META_PAGE_ID manquant");
  }

  const encryptedPageToken = encryptMetaToken(params.pageToken);
  const encryptedUserToken = params.userToken ? encryptMetaToken(params.userToken) : null;

  return prisma.metaConnection.upsert({
    where: { userId: params.userId },
    update: {
      pageId: env.META_PAGE_ID,
      pageName: params.pageName ?? null,
      pageAccessTokenEncrypted: encryptedPageToken,
      userAccessTokenEncrypted: encryptedUserToken,
      scopes: [...REQUIRED_META_SCOPES],
      connectedAt: new Date(),
      revokedAt: null,
      lastSyncAt: new Date(),
    },
    create: {
      userId: params.userId,
      pageId: env.META_PAGE_ID,
      pageName: params.pageName ?? null,
      pageAccessTokenEncrypted: encryptedPageToken,
      userAccessTokenEncrypted: encryptedUserToken,
      scopes: [...REQUIRED_META_SCOPES],
      connectedAt: new Date(),
      lastSyncAt: new Date(),
    },
  });
}

export async function completeMetaOAuthConnection(userId: string, code: string) {
  const userToken = await exchangeMetaCodeForToken(code);
  const page = await fetchPageTokenFromUserToken(userToken);
  return upsertMetaConnectionFromToken({ userId, pageToken: page.pageToken, pageName: page.pageName, userToken });
}

export async function connectMetaFromEnvToken(userId: string) {
  if (!env.META_PAGE_ACCESS_TOKEN) {
    throw new Error("META_PAGE_ACCESS_TOKEN manquant");
  }

  return upsertMetaConnectionFromToken({
    userId,
    pageToken: env.META_PAGE_ACCESS_TOKEN,
    pageName: "Simon Morin - Agent de location",
  });
}

export async function disconnectMeta(userId: string) {
  await prisma.metaConnection.deleteMany({ where: { userId } });
}

async function resolveMetaTokens(userId: string) {
  const connection = await prisma.metaConnection.findUnique({ where: { userId } });

  let pageToken: string | null = null;
  let userToken: string | null = null;
  const issues: string[] = [];

  if (connection) {
    try {
      pageToken = decryptMetaToken(connection.pageAccessTokenEncrypted);
      if (connection.userAccessTokenEncrypted) {
        userToken = decryptMetaToken(connection.userAccessTokenEncrypted);
      }
    } catch {
      issues.push("Le dechiffrement du jeton Meta a echoue.");
    }
  } else if (env.META_PAGE_ACCESS_TOKEN) {
    pageToken = env.META_PAGE_ACCESS_TOKEN;
  }

  return {
    connection,
    pageToken,
    userToken,
    issues,
  };
}

async function getAdvertisementForPagePublication(advertisementId: string) {
  return prisma.advertisement.findUnique({
    where: { id: advertisementId },
    include: {
      property: { include: { photos: { orderBy: { sortOrder: "asc" } } } },
      selectedPhotos: {
        where: { channel: "PAGE", excluded: false },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        include: { propertyPhoto: true },
      },
      publications: { where: { channel: "PAGE" }, orderBy: { createdAt: "desc" } },
    },
  });
}

function assertAdvertisementReadyForFacebook(ad: Awaited<ReturnType<typeof getAdvertisementForPagePublication>>) {
  if (!ad || !ad.property) {
    throw new Error("Annonce introuvable");
  }

  if (ad.status !== AdvertisementStatus.APPROVED) {
    throw new Error("Annonce non approuvee");
  }

  if (["RENTED", "REMOVED", "TO_VERIFY", "ARCHIVED"].includes(ad.property.status)) {
    throw new Error("Le logement n'est plus disponible pour publication");
  }

  if (!ad.title.trim()) {
    throw new Error("Titre vide");
  }

  if (!ad.body.trim()) {
    throw new Error("Texte vide");
  }

  if (!ad.property.monthlyPrice) {
    throw new Error("Prix manquant");
  }

  return ad;
}

function getSelectedPhotoUrls(ad: NonNullable<Awaited<ReturnType<typeof getAdvertisementForPagePublication>>>) {
  const rawPhotoUrls = ad.selectedPhotos.length > 0
    ? ad.selectedPhotos.map((item) => item.propertyPhoto.url)
    : ad.property!.photos.map((photo) => photo.url);
  return dedupePhotoUrls(rawPhotoUrls);
}

export async function prepareManualFacebookPublication(params: { advertisementId: string; userId: string }) {
  const ad = assertAdvertisementReadyForFacebook(await getAdvertisementForPagePublication(params.advertisementId));

  const prepared = buildManualFacebookText({
    title: ad.title,
    property: {
      id: ad.property!.id,
      rentalUnitId: ad.property!.rentalUnitId,
      monthlyPrice: ad.property!.monthlyPrice,
      bedrooms: ad.property!.bedrooms,
      city: ad.property!.city,
      district: ad.property!.district,
      propertyType: ad.property!.propertyType,
      petsAllowed: ad.property!.petsAllowed,
      parking: ad.property!.parking,
      inclusions: ad.property!.inclusions,
      availableFrom: ad.property!.availableFrom,
      address: ad.property!.address,
    },
  });

  const photoUrls = getSelectedPhotoUrls(ad);
  const facebookOpenUrl = buildManualFacebookOpenUrl(prepared);

  await prisma.advertisementPublication.create({
    data: {
      advertisementId: ad.id,
      channel: "PAGE",
      status: AdvertisementStatus.MANUAL_ACTION_REQUIRED,
      destination: prepared.listingPath,
      checklist: {
        manualPreparationOpenedAt: new Date().toISOString(),
        selectedPhotoUrls: photoUrls,
        facebookOpenUrl,
      },
      errorMessage: null,
    },
  });

  await prisma.advertisement.update({
    where: { id: ad.id },
    data: {
      status: AdvertisementStatus.MANUAL_ACTION_REQUIRED,
      publicationChannel: "PAGE",
      requiresManualAction: true,
      publishedByUserId: params.userId,
      latestErrorMessage: null,
    },
  });

  return {
    message: prepared.message,
    listingUrl: prepared.listingUrl,
    facebookOpenUrl,
    photoUrls,
    primaryPhotoUrl: photoUrls[0] ?? null,
  } as ManualPublicationPayload;
}

export async function confirmManualFacebookPublication(params: { advertisementId: string; userId: string; publicationUrl: string }) {
  const publicationUrl = cleanText(params.publicationUrl);
  if (!validateFacebookPublicationUrl(publicationUrl)) {
    throw new Error("URL Facebook invalide. Utilisez un lien public Facebook valide en https.");
  }

  const ad = await prisma.advertisement.findUnique({ where: { id: params.advertisementId } });
  if (!ad) {
    throw new Error("Annonce introuvable");
  }

  const publication = await prisma.advertisementPublication.create({
    data: {
      advertisementId: ad.id,
      channel: "PAGE",
      status: AdvertisementStatus.PUBLISHED,
      destination: publicationUrl,
      publicationUrl,
      checklist: {
        manualConfirmedAt: new Date().toISOString(),
      },
      publishedAt: new Date(),
      errorMessage: null,
    },
  });

  await prisma.advertisement.update({
    where: { id: ad.id },
    data: {
      status: AdvertisementStatus.PUBLISHED,
      publicationChannel: "PAGE",
      publicationUrl,
      publishedAt: new Date(),
      publishedByUserId: params.userId,
      requiresManualAction: false,
      latestErrorMessage: null,
    },
  });

  return publication;
}

export async function getMetaDiagnostic(userId: string): Promise<MetaDiagnosticResult> {
  const configIssues = ensureRequiredMetaConfig();
  const issues = [...configIssues];
  const usingDefaultGraphApiVersion = !process.env.META_GRAPH_API_VERSION?.trim();

  if (usingDefaultGraphApiVersion) {
    issues.push(`Version Graph API par defaut utilisee (${GRAPH_API_VERSION}). Definissez META_GRAPH_API_VERSION explicitement.`);
  }

  const { connection, pageToken, userToken, issues: tokenResolveIssues } = await resolveMetaTokens(userId);
  issues.push(...tokenResolveIssues);

  let tokenValid = false;
  let tokenRevoked = false;
  let tokenExpiresAt: string | null = null;
  let pageName: string | null = connection?.pageName ?? null;
  let pageIdMatches = false;
  let grantedScopes: string[] = Array.from(new Set(connection?.scopes ?? []));

  if (!connection) {
    issues.push("Aucune connexion MetaConnection en base de donnees.");
  }

  if (!pageToken) {
    issues.push("Jeton de Page Facebook absent.");
  }

  if (env.META_REDIRECT_URI && !env.META_REDIRECT_URI.endsWith("/api/integrations/meta/facebook/callback")) {
    issues.push("META_REDIRECT_URI doit pointer vers /api/integrations/meta/facebook/callback.");
  }

  const publicAppUrl = getPublicAppUrl();

  if (env.META_REDIRECT_URI && publicAppUrl && !env.META_REDIRECT_URI.startsWith(publicAppUrl)) {
    issues.push("META_REDIRECT_URI ne correspond pas au domaine public configure.");
  }

  if (pageToken && env.META_PAGE_ID) {
    const pageQuery = new URLSearchParams({
      fields: "id,name",
      access_token: pageToken,
    });

    const pageResult = await fetchMetaJson<{ id?: string; name?: string }>(`${GRAPH_BASE}/${env.META_PAGE_ID}?${pageQuery.toString()}`);
    if (pageResult.response.ok && pageResult.payload.id) {
      tokenValid = true;
      pageIdMatches = pageResult.payload.id === env.META_PAGE_ID;
      pageName = pageResult.payload.name ?? pageName;
    } else {
      const metaError = parseMetaError(pageResult.payload);
      const message = formatMetaError(metaError);
      issues.push(message);
      if (metaError?.code === 190) {
        tokenRevoked = true;
      }
    }
  }

  if (userToken) {
    const accountsQuery = new URLSearchParams({
      access_token: userToken,
      fields: "id,name,perms",
    });
    const accountsResult = await fetchMetaJson<{ data?: Array<{ id: string; name: string; perms?: string[] }> }>(`${GRAPH_BASE}/me/accounts?${accountsQuery.toString()}`);

    if (accountsResult.response.ok) {
      const page = (accountsResult.payload.data ?? []).find((item) => item.id === env.META_PAGE_ID);
      if (!page) {
        issues.push("La Page Facebook configuree n'est pas accessible avec ce compte. Verifiez que Simon possede un acces complet a la Page et reconnectez Facebook.");
      } else {
        pageIdMatches = true;
        pageName = page.name || pageName;
        grantedScopes = Array.from(new Set([...(page.perms ?? []), ...grantedScopes]));
      }
    }
  }

  if (pageToken && env.META_APP_ID && env.META_APP_SECRET) {
    const appToken = `${env.META_APP_ID}|${env.META_APP_SECRET}`;
    const debugQuery = new URLSearchParams({
      input_token: pageToken,
      access_token: appToken,
    });

    const debugResult = await fetchMetaJson<{
      data?: {
        is_valid?: boolean;
        scopes?: string[];
        expires_at?: number;
      };
    }>(`${GRAPH_BASE}/debug_token?${debugQuery.toString()}`);

    if (debugResult.response.ok && debugResult.payload.data) {
      const debugData = debugResult.payload.data;
      tokenValid = Boolean(debugData.is_valid) && tokenValid;
      grantedScopes = Array.from(new Set([...(debugData.scopes ?? []), ...grantedScopes]));

      if (typeof debugData.expires_at === "number" && debugData.expires_at > 0) {
        const expiry = new Date(debugData.expires_at * 1000);
        tokenExpiresAt = expiry.toISOString();
        if (expiry.getTime() < Date.now()) {
          tokenRevoked = true;
          issues.push("Le jeton de Page Facebook est expire.");
        }
      }

      if (debugData.is_valid === false) {
        tokenRevoked = true;
        issues.push("Le jeton de Page Facebook est invalide ou revoque.");
      }
    }
  }

  const missingScopes = REQUIRED_META_SCOPES.filter((scope) => !grantedScopes.includes(scope));
  for (const scope of missingScopes) {
    issues.push(`Permission manquante: ${scope}`);
  }

  if (!pageIdMatches && env.META_PAGE_ID) {
    issues.push("Le Page ID ne correspond pas a la Page connectee.");
  }

  return {
    configured: configIssues.length === 0,
    connected: Boolean(connection || env.META_PAGE_ACCESS_TOKEN),
    pageIdMatches,
    pageName,
    tokenValid,
    grantedScopes,
    missingScopes,
    graphApiVersion: GRAPH_API_VERSION,
    issues: Array.from(new Set(issues)),
    pageId: env.META_PAGE_ID ?? connection?.pageId ?? null,
    configIssues,
    connectionExists: Boolean(connection),
    tokenExpiresAt,
    tokenRevoked,
    usingDefaultGraphApiVersion,
  };
}

export async function getMetaStatus(userId: string) {
  const diagnostic = await getMetaDiagnostic(userId);
  return {
    configured: isMetaConfigured,
    configIssues: getMetaConfigIssues(),
    connected: diagnostic.connected,
    pageId: diagnostic.pageId,
    pageName: diagnostic.pageName,
    lastSyncAt: diagnostic.connectionExists ? new Date().toISOString() : null,
    graphApiVersion: diagnostic.graphApiVersion,
    tokenValid: diagnostic.tokenValid,
    missingPermissions: diagnostic.missingScopes,
    grantedPermissions: diagnostic.grantedScopes,
    issues: diagnostic.issues,
  };
}

async function getMetaPageToken(userId: string) {
  const tokenResult = await resolveMetaTokens(userId);
  if (!tokenResult.pageToken) {
    throw new Error("Connexion a la Page Facebook non configuree");
  }
  return tokenResult.pageToken;
}

async function publishFeed(params: { pageId: string; pageToken: string; message: string; link: string; attachedMedia?: string[] }) {
  const body = new URLSearchParams({
    message: params.message,
    link: params.link,
    access_token: params.pageToken,
  });

  if (params.attachedMedia) {
    params.attachedMedia.forEach((mediaId, index) => {
      body.append(`attached_media[${index}]`, JSON.stringify({ media_fbid: mediaId }));
    });
  }

  const result = await fetchMetaJson<MetaResponsePayload>(`${GRAPH_BASE}/${params.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!result.response.ok || !result.payload.id) {
    throw parseMetaError(result.payload) ?? { message: "Echec publication Meta" };
  }

  return result.payload.id;
}

async function uploadUnpublishedPhoto(params: { pageId: string; pageToken: string; url: string }) {
  const body = new URLSearchParams({
    url: params.url,
    published: "false",
    access_token: params.pageToken,
  });

  const result = await fetchMetaJson<MetaResponsePayload>(`${GRAPH_BASE}/${params.pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!result.response.ok || !result.payload.id) {
    throw parseMetaError(result.payload) ?? { message: "Meta a refuse une des photos." };
  }

  return result.payload.id;
}

async function publishSinglePhoto(params: { pageId: string; pageToken: string; message: string; photoUrl: string }) {
  const body = new URLSearchParams({
    url: params.photoUrl,
    caption: params.message,
    published: "true",
    access_token: params.pageToken,
  });

  const result = await fetchMetaJson<MetaResponsePayload>(`${GRAPH_BASE}/${params.pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!result.response.ok || (!result.payload.post_id && !result.payload.id)) {
    throw parseMetaError(result.payload) ?? { message: "Meta a refuse la photo principale." };
  }

  return result.payload.post_id || result.payload.id!;
}

async function resolvePermalinkUrl(params: { pageToken: string; publicationId: string }) {
  const query = new URLSearchParams({
    fields: "permalink_url",
    access_token: params.pageToken,
  });

  const result = await fetchMetaJson<{ permalink_url?: string }>(`${GRAPH_BASE}/${params.publicationId}?${query.toString()}`);
  if (!result.response.ok) {
    return null;
  }

  const permalink = result.payload.permalink_url?.trim();
  if (!permalink || !isHttpUrl(permalink)) {
    return null;
  }

  return permalink;
}

async function finalizeFailure(params: { advertisementId: string; publicationId: string; message: string; details?: string | null }) {
  await prisma.$transaction([
    prisma.advertisement.update({
      where: { id: params.advertisementId },
      data: { status: AdvertisementStatus.FAILED, latestErrorMessage: params.message },
    }),
    prisma.advertisementPublication.update({
      where: { id: params.publicationId },
      data: { status: AdvertisementStatus.FAILED, errorMessage: params.details || params.message },
    }),
  ]);
}

export async function publishAdvertisementToMetaPage(params: { advertisementId: string; userId: string; idempotencyKey: string }) {
  const ad = assertAdvertisementReadyForFacebook(await getAdvertisementForPagePublication(params.advertisementId));

  if (!env.META_PAGE_ID) {
    throw new Error("META_PAGE_ID manquant");
  }

  const selectedPhotoUrls = getSelectedPhotoUrls(ad);
  const prepared = buildManualFacebookText({
    title: ad.title,
    property: {
      id: ad.property!.id,
      rentalUnitId: ad.property!.rentalUnitId,
      monthlyPrice: ad.property!.monthlyPrice,
      bedrooms: ad.property!.bedrooms,
      city: ad.property!.city,
      district: ad.property!.district,
      propertyType: ad.property!.propertyType,
      petsAllowed: ad.property!.petsAllowed,
      parking: ad.property!.parking,
      inclusions: ad.property!.inclusions,
      availableFrom: ad.property!.availableFrom,
      address: ad.property!.address,
    },
  });

  const fingerprint = buildFingerprint(ad.title, prepared.message, selectedPhotoUrls);
  const duplicate = await prisma.advertisementPublication.findFirst({
    where: {
      channel: "PAGE",
      status: AdvertisementStatus.PUBLISHED,
      advertisementId: { not: ad.id },
      destination: fingerprint,
    },
  });

  if (duplicate) {
    throw new Error("Publication identique deja publiee");
  }

  const existingIdempotent = await prisma.advertisementPublication.findUnique({ where: { idempotencyKey: params.idempotencyKey } });
  if (existingIdempotent?.externalId) {
    return existingIdempotent;
  }
  if (existingIdempotent?.status === AdvertisementStatus.PUBLISHING) {
    throw new Error("Publication deja en cours pour cette cle d'idempotence.");
  }
  if (existingIdempotent?.status === AdvertisementStatus.FAILED) {
    throw new Error("Cette tentative a deja echoue. Relancez avec une nouvelle cle d'idempotence.");
  }

  const token = await getMetaPageToken(params.userId);

  if (process.env.META_DRY_RUN === "true") {
    await prisma.advertisement.update({
      where: { id: ad.id },
      data: {
        status: AdvertisementStatus.PUBLISHED,
        publicationChannel: "PAGE",
        idempotencyKey: params.idempotencyKey,
        contentFingerprint: fingerprint,
        publishedAt: new Date(),
        publicationUrl: "https://example.com/meta/dry-run",
        externalPublicationId: "dry-run",
        requiresManualAction: false,
        latestErrorMessage: null,
      },
    });

    return prisma.advertisementPublication.create({
      data: {
        advertisementId: ad.id,
        channel: "PAGE",
        status: AdvertisementStatus.PUBLISHED,
        destination: fingerprint,
        idempotencyKey: params.idempotencyKey,
        externalId: "dry-run",
        publicationUrl: "https://example.com/meta/dry-run",
        publishedAt: new Date(),
      },
    });
  }

  await prisma.advertisement.update({
    where: { id: ad.id },
    data: {
      status: AdvertisementStatus.PUBLISHING,
      publicationChannel: "PAGE",
      idempotencyKey: params.idempotencyKey,
      contentFingerprint: fingerprint,
    },
  });

  const publication = await prisma.advertisementPublication.create({
    data: {
      advertisementId: ad.id,
      channel: "PAGE",
      status: AdvertisementStatus.PUBLISHING,
      destination: fingerprint,
      idempotencyKey: params.idempotencyKey,
    },
  });

  let externalId: string | null = null;
  let warningMessage: string | null = null;

  try {
    if (selectedPhotoUrls.length === 1) {
      externalId = await publishSinglePhoto({
        pageId: env.META_PAGE_ID,
        pageToken: token,
        message: prepared.message,
        photoUrl: selectedPhotoUrls[0],
      });
    } else if (selectedPhotoUrls.length > 1) {
      const uploadedMediaIds: string[] = [];
      for (const photoUrl of selectedPhotoUrls) {
        const mediaId = await uploadUnpublishedPhoto({ pageId: env.META_PAGE_ID, pageToken: token, url: photoUrl });
        uploadedMediaIds.push(mediaId);
      }

      externalId = await publishFeed({
        pageId: env.META_PAGE_ID,
        pageToken: token,
        message: prepared.message,
        link: prepared.listingUrl,
        attachedMedia: uploadedMediaIds,
      });
    } else {
      externalId = await publishFeed({
        pageId: env.META_PAGE_ID,
        pageToken: token,
        message: prepared.message,
        link: prepared.listingUrl,
      });
    }
  } catch (publishError) {
    const parsedError = parseMetaError({ error: publishError as MetaGraphError }) ||
      (typeof publishError === "object" && publishError !== null && "message" in publishError
        ? ({ message: String((publishError as { message: string }).message) } as ReturnType<typeof parseMetaError>)
        : null);

    try {
      externalId = await publishFeed({
        pageId: env.META_PAGE_ID,
        pageToken: token,
        message: prepared.message,
        link: prepared.listingUrl,
      });
      warningMessage = formatMetaError(parsedError);
    } catch (fallbackError) {
      const fallbackParsed = parseMetaError({ error: fallbackError as MetaGraphError }) ||
        (typeof fallbackError === "object" && fallbackError !== null && "message" in fallbackError
          ? ({ message: String((fallbackError as { message: string }).message) } as ReturnType<typeof parseMetaError>)
          : null);
      const safeError = formatMetaError(fallbackParsed);

      await finalizeFailure({
        advertisementId: ad.id,
        publicationId: publication.id,
        message: safeError,
        details: buildMetaErrorDetails(fallbackParsed),
      });

      throw new Error(safeError);
    }
  }

  if (!externalId) {
    await finalizeFailure({
      advertisementId: ad.id,
      publicationId: publication.id,
      message: "Meta n'a retourne aucun identifiant de publication.",
    });
    throw new Error("Meta n'a retourne aucun identifiant de publication.");
  }

  const permalink = await resolvePermalinkUrl({ pageToken: token, publicationId: externalId });
  const publicationUrl = permalink || `https://www.facebook.com/${externalId}`;

  return prisma.$transaction(async (tx) => {
    const updatedPublication = await tx.advertisementPublication.update({
      where: { id: publication.id },
      data: {
        status: AdvertisementStatus.PUBLISHED,
        externalId,
        publicationUrl,
        publishedAt: new Date(),
        errorMessage: warningMessage,
      },
    });

    await tx.advertisement.update({
      where: { id: ad.id },
      data: {
        status: AdvertisementStatus.PUBLISHED,
        publishedAt: new Date(),
        publicationUrl,
        externalPublicationId: externalId,
        publishedByUserId: params.userId,
        requiresManualAction: false,
        latestErrorMessage: warningMessage,
      },
    });

    return updatedPublication;
  });
}
