import { AdvertisementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { groupPublicationSchema } from "@/lib/validators";

export async function POST(request: NextRequest, { params }: { params: Promise<{ adId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { adId } = await params;
    const body = await request.json();
    const parsed = groupPublicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const ad = await prisma.advertisement.findUnique({ where: { id: adId } });
    if (!ad) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    const publication = await prisma.facebookGroupPublication.upsert({
      where: { advertisementId_groupId: { advertisementId: ad.id, groupId: parsed.data.groupId } },
      create: {
        advertisementId: ad.id,
        groupId: parsed.data.groupId,
        customText: cleanText(parsed.data.customText) || null,
        publicationUrl: parsed.data.publicationUrl || null,
        status: parsed.data.status,
        warningMessages: [],
        publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
      },
      update: {
        customText: cleanText(parsed.data.customText) || null,
        publicationUrl: parsed.data.publicationUrl || null,
        status: parsed.data.status,
        publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
      },
      include: { group: true },
    });

    if (parsed.data.status === "PUBLISHED") {
      await prisma.facebookGroup.update({ where: { id: parsed.data.groupId }, data: { lastPublishedAt: new Date() } });
      await prisma.advertisement.update({
        where: { id: ad.id },
        data: {
          status: AdvertisementStatus.PUBLISHED,
          publicationChannel: "FACEBOOK_GROUP",
          publicationUrl: parsed.data.publicationUrl || ad.publicationUrl,
          publishedAt: new Date(),
          publishedByUserId: auth.user!.id,
        },
      });
    } else {
      await prisma.advertisement.update({
        where: { id: ad.id },
        data: {
          status: AdvertisementStatus.MANUAL_ACTION_REQUIRED,
          publicationChannel: "FACEBOOK_GROUP",
          requiresManualAction: true,
        },
      });
    }

    return NextResponse.json({ item: publication });
  } catch {
    return safeServerError();
  }
}
