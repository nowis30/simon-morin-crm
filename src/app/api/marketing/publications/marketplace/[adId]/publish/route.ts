import { AdvertisementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { marketplacePublishSchema } from "@/lib/validators";

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
    const parsed = marketplacePublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const ad = await prisma.advertisement.findUnique({ where: { id: adId } });
    if (!ad) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    if (ad.status !== AdvertisementStatus.APPROVED && ad.status !== AdvertisementStatus.MANUAL_ACTION_REQUIRED) {
      return NextResponse.json({ error: "Annonce non approuvee pour publication" }, { status: 400 });
    }

    const publication = await prisma.advertisementPublication.upsert({
      where: { idempotencyKey: `manual-marketplace-${ad.id}` },
      create: {
        advertisementId: ad.id,
        channel: "MARKETPLACE",
        status: AdvertisementStatus.PUBLISHED,
        destination: parsed.data.publicationUrl,
        publicationUrl: parsed.data.publicationUrl,
        checklist: parsed.data.checklist,
        idempotencyKey: `manual-marketplace-${ad.id}`,
        publishedAt: new Date(),
      },
      update: {
        status: AdvertisementStatus.PUBLISHED,
        destination: parsed.data.publicationUrl,
        publicationUrl: parsed.data.publicationUrl,
        checklist: parsed.data.checklist,
        publishedAt: new Date(),
      },
    });

    await prisma.advertisement.update({
      where: { id: ad.id },
      data: {
        status: AdvertisementStatus.PUBLISHED,
        publicationChannel: "MARKETPLACE",
        publicationUrl: parsed.data.publicationUrl,
        publishedAt: new Date(),
        publishedByUserId: auth.user!.id,
      },
    });

    return NextResponse.json({ item: publication });
  } catch {
    return safeServerError();
  }
}
