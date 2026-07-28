import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { buildAdvertisementVersionPayload, createAdvertisementDrafts, GENERATOR_VERSION } from "@/lib/marketing";
import type { AdLanguage, AdType } from "@prisma/client";

type OverrideItem = {
  type: AdType;
  language: AdLanguage;
  title: string;
  body: string;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ propertyId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { propertyId } = await params;
    const property = await prisma.property.findUnique({ where: { id: propertyId }, include: { photos: true } });

    if (!property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const defaultPayloads = createAdvertisementDrafts(property);
    const body = (await request.json().catch(() => ({}))) as { items?: OverrideItem[] };

    const payloads = Array.isArray(body.items) && body.items.length > 0
      ? defaultPayloads.map((draft) => {
          const custom = body.items?.find((item) => item.type === draft.type && item.language === draft.language);
          if (!custom) {
            return draft;
          }
          return {
            ...draft,
            title: custom.title?.trim() || draft.title,
            body: custom.body?.trim() || draft.body,
          };
        })
      : defaultPayloads;

    const ads = [];
    for (const payload of payloads) {
      const existing = await prisma.advertisement.findFirst({
        where: { propertyId: property.id, type: payload.type, language: payload.language },
      });

      const ad = existing
        ? await prisma.advertisement.update({
            where: { id: existing.id },
            data: {
              title: payload.title,
              body: payload.body,
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
            include: { versions: true },
          })
        : await prisma.advertisement.create({
        data: {
          propertyId,
          type: payload.type,
          language: payload.language,
          title: payload.title,
          body: payload.body,
          generatedAutomatically: true,
          manuallyEdited: false,
          generatedAt: new Date(),
          sourcePropertyUpdatedAt: property.updatedAt,
          generatorVersion: GENERATOR_VERSION,
          versions: {
            create: {
              ...buildAdvertisementVersionPayload(payload, "AUTO_GENERATION"),
            },
          },
        },
        include: { versions: true },
      });
      ads.push(ad);
    }

    return NextResponse.json({ items: ads }, { status: 201 });
  } catch {
    return safeServerError();
  }
}
