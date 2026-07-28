import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import {
  buildAdvertisementVersionPayload,
  GENERATOR_VERSION,
  REGENERATION_BATCH_SIZE,
  processAdvertisementBatch,
  type AdDraft,
  type GenerationMode,
  type MarketingAd,
  type MarketingProperty,
} from "@/lib/marketing";

type Payload = {
  mode?: GenerationMode;
  offset?: number;
  batchSize?: number;
};

function getMode(mode?: string): GenerationMode {
  if (mode === "AUTOMATIC_ONLY" || mode === "FORCE_ALL") {
    return mode;
  }
  return "INCOMPLETE_ONLY";
}

async function createOrUpdateAdvertisement(property: MarketingProperty, draft: AdDraft, existing?: MarketingAd) {
  if (existing) {
    return prisma.advertisement.update({
      where: { id: existing.id },
      data: {
        title: draft.title,
        body: draft.body,
        generatedAutomatically: true,
        manuallyEdited: false,
        generatedAt: new Date(),
        sourcePropertyUpdatedAt: property.updatedAt,
        generatorVersion: GENERATOR_VERSION,
        versions: {
          create: {
                  ...buildAdvertisementVersionPayload(existing, "AUTO_REGENERATION"),
          },
        },
      },
    });
  }

  return prisma.advertisement.create({
    data: {
      propertyId: property.id,
      type: draft.type,
      language: draft.language,
      title: draft.title,
      body: draft.body,
      generatedAutomatically: true,
      manuallyEdited: false,
      generatedAt: new Date(),
      sourcePropertyUpdatedAt: property.updatedAt,
      generatorVersion: GENERATOR_VERSION,
      versions: {
        create: {
          ...buildAdvertisementVersionPayload(draft, "AUTO_GENERATION"),
        },
      },
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const payload = (await request.json()) as Payload;
    const mode = getMode(payload.mode);
    const offset = Math.max(0, payload.offset ?? 0);
    const batchSize = Math.max(1, Math.min(20, payload.batchSize ?? REGENERATION_BATCH_SIZE));

    const properties = await prisma.property.findMany({
      where: { status: { notIn: ["RENTED", "REMOVED", "ARCHIVED"] } },
      include: { photos: { orderBy: { sortOrder: "asc" } } },
      orderBy: { codeIsr: "asc" },
    });
    const ads = await prisma.advertisement.findMany({
      where: { propertyId: { in: properties.map((property) => property.id) } },
      orderBy: { createdAt: "desc" },
    });

    const result = await processAdvertisementBatch({
      properties,
      ads,
      mode,
      offset,
      batchSize,
      handlers: {
        createAdvertisement: async (property, draft) => {
          await createOrUpdateAdvertisement(property, draft);
        },
        updateAdvertisement: async (property, existing, draft) => {
          await createOrUpdateAdvertisement(property, draft, existing);
        },
      },
    });

    const percent = properties.length === 0 ? 100 : Math.round((result.processedProperties / properties.length) * 100);

    return NextResponse.json({
      processedProperties: result.processedProperties,
      generated: result.delta.regeneratedAdvertisements,
      skipped: result.delta.skippedAdvertisements,
      protected: result.delta.protectedAdvertisements,
      alreadyUpToDate: result.delta.alreadyUpToDate,
      errors: result.delta.errors,
      missingAdvertisements: result.delta.missingAdvertisements,
      percent,
      nextOffset: result.nextOffset,
      totalProperties: properties.length,
      analyzedAdvertisements: result.delta.analyzedAdvertisements,
    });
  } catch {
    return safeServerError();
  }
}