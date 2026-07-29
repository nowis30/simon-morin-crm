import { randomBytes } from "crypto";
import { AdvertisementStatus } from "@prisma/client";
import { env, getMetaConfigIssues, isMetaConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { decryptMetaToken, encryptMetaToken } from "@/lib/meta-token-crypto";
import { cleanText } from "@/lib/sanitize";

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

export function createMetaState(userId: string) {
  return `${userId}:${randomBytes(12).toString("hex")}`;
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
    scope: "pages_manage_posts,pages_read_engagement,pages_show_list",
  });
  return `https://www.facebook.com/v20.0/dialog/oauth?${query.toString()}`;
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

  const response = await fetch(`${GRAPH_BASE}/oauth/access_token?${query.toString()}`);
  const data = (await response.json()) as { access_token?: string };
  if (!response.ok || !data.access_token) {
    throw new Error("Echec OAuth Meta");
  }
  return data.access_token;
}

async function fetchPageTokenFromUserToken(userToken: string) {
  if (!env.META_PAGE_ID) {
    throw new Error("META_PAGE_ID manquant");
  }

  const response = await fetch(`${GRAPH_BASE}/me/accounts?access_token=${encodeURIComponent(userToken)}`);
  const data = (await response.json()) as { data?: Array<{ id: string; name: string; access_token: string }> };
  if (!response.ok) {
    throw new Error("Impossible de recuperer les pages Meta");
  }

  const page = (data.data ?? []).find((item) => item.id === env.META_PAGE_ID);
  if (!page?.access_token) {
    throw new Error("Page Meta introuvable ou acces refuse");
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
      scopes: ["pages_manage_posts", "pages_read_engagement"],
      connectedAt: new Date(),
      revokedAt: null,
    },
    create: {
      userId: params.userId,
      pageId: env.META_PAGE_ID,
      pageName: params.pageName ?? null,
      pageAccessTokenEncrypted: encryptedPageToken,
      userAccessTokenEncrypted: encryptedUserToken,
      scopes: ["pages_manage_posts", "pages_read_engagement"],
      connectedAt: new Date(),
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
  return upsertMetaConnectionFromToken({ userId, pageToken: env.META_PAGE_ACCESS_TOKEN, pageName: "Simon Morin - Agent de location" });
}

export async function disconnectMeta(userId: string) {
  await prisma.metaConnection.deleteMany({ where: { userId } });
}

export async function getMetaStatus(userId: string) {
  const configIssues = getMetaConfigIssues();
  const connection = await prisma.metaConnection.findUnique({ where: { userId } });
  return {
    configured: isMetaConfigured,
    configIssues,
    connected: Boolean(connection),
    pageId: connection?.pageId ?? env.META_PAGE_ID ?? null,
    pageName: connection?.pageName ?? null,
    lastSyncAt: connection?.lastSyncAt ?? null,
  };
}

async function getMetaPageToken(userId: string) {
  const connection = await prisma.metaConnection.findUnique({ where: { userId } });
  if (connection) {
    return decryptMetaToken(connection.pageAccessTokenEncrypted);
  }
  if (env.META_PAGE_ACCESS_TOKEN) {
    return env.META_PAGE_ACCESS_TOKEN;
  }
  throw new Error("Connexion a la Page Facebook non configuree");
}

function buildFingerprint(title: string, body: string, photoUrls: string[]) {
  return `${title.trim()}|${body.trim()}|${photoUrls.join("|")}`.toLowerCase();
}

export async function publishAdvertisementToMetaPage(params: {
  advertisementId: string;
  userId: string;
  idempotencyKey: string;
}) {
  const ad = await prisma.advertisement.findUnique({
    where: { id: params.advertisementId },
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

  if (!ad || !ad.property) {
    throw new Error("Annonce introuvable");
  }

  if (ad.status !== AdvertisementStatus.APPROVED) {
    throw new Error("Annonce non approuvee");
  }

  if (["RENTED", "REMOVED", "TO_VERIFY", "ARCHIVED"].includes(ad.property.status)) {
    throw new Error("Le logement n'est plus disponible pour publication");
  }

  const selectedPhotoUrls = ad.selectedPhotos.length > 0
    ? ad.selectedPhotos.map((item) => item.propertyPhoto.url)
    : ad.property.photos.map((photo) => photo.url);

  if (!ad.title.trim() || !ad.body.trim()) {
    throw new Error("Titre ou texte vide");
  }

  if (!ad.property.monthlyPrice || selectedPhotoUrls.length === 0) {
    throw new Error("Prix ou photos manquants");
  }

  const fingerprint = buildFingerprint(ad.title, ad.body, selectedPhotoUrls);
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

  const endpoint = `${GRAPH_BASE}/${env.META_PAGE_ID}/feed`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      message: `${ad.title}\n\n${ad.body}`,
      access_token: token,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };

  if (!response.ok || !payload.id) {
    const safeError = cleanText(payload.error?.message) || "Echec de publication Meta";
    await prisma.$transaction([
      prisma.advertisement.update({
        where: { id: ad.id },
        data: { status: AdvertisementStatus.FAILED, latestErrorMessage: safeError },
      }),
      prisma.advertisementPublication.update({
        where: { id: publication.id },
        data: { status: AdvertisementStatus.FAILED, errorMessage: safeError },
      }),
    ]);
    throw new Error(safeError);
  }

  const publicationUrl = `https://www.facebook.com/${payload.id}`;

  return prisma.$transaction(async (tx) => {
    const updatedPublication = await tx.advertisementPublication.update({
      where: { id: publication.id },
      data: {
        status: AdvertisementStatus.PUBLISHED,
        externalId: payload.id,
        publicationUrl,
        publishedAt: new Date(),
      },
    });

    await tx.advertisement.update({
      where: { id: ad.id },
      data: {
        status: AdvertisementStatus.PUBLISHED,
        publishedAt: new Date(),
        publicationUrl,
        externalPublicationId: payload.id,
        publishedByUserId: params.userId,
        latestErrorMessage: null,
      },
    });

    return updatedPublication;
  });
}
