import { AdvertisementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { marketplaceManualConfirmSchema } from "@/lib/validators";

export async function POST(request: NextRequest, { params }: { params: Promise<{ advertisementId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { advertisementId } = await params;
    const body = await request.json();
    const parsed = marketplaceManualConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const ad = await prisma.advertisement.findUnique({ where: { id: advertisementId } });
    if (!ad) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    const publicationUrl = parsed.data.publicationUrl?.trim() || null;
    const publishedAt = parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date();
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    const notes = cleanText(parsed.data.notes || "") || null;

    const publication = await prisma.advertisementPublication.create({
      data: {
        advertisementId: ad.id,
        channel: "MARKETPLACE",
        status: AdvertisementStatus.PUBLISHED,
        destination: publicationUrl,
        publicationUrl,
        checklist: {
          manualMarketplaceConfirmedAt: new Date().toISOString(),
          notes,
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
        },
        publishedAt,
      },
    });

    await prisma.advertisement.update({
      where: { id: ad.id },
      data: {
        status: AdvertisementStatus.PUBLISHED,
        publicationChannel: "MARKETPLACE",
        publicationUrl: publicationUrl || ad.publicationUrl,
        publishedAt,
        publishedByUserId: auth.user!.id,
        requiresManualAction: false,
      },
    });

    return NextResponse.json({ item: publication });
  } catch {
    return safeServerError();
  }
}
