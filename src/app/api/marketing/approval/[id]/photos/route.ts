import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { advertisementPhotoSelectionSchema } from "@/lib/validators";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = advertisementPhotoSelectionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const ad = await prisma.advertisement.findUnique({
      where: { id },
      include: { property: { include: { photos: true } } },
    });

    if (!ad || !ad.property) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    const photoIdSet = new Set(ad.property.photos.map((photo) => photo.id));
    const unknown = parsed.data.items.find((item) => !photoIdSet.has(item.propertyPhotoId));
    if (unknown) {
      return NextResponse.json({ error: "Une photo ne correspond pas au logement" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.advertisementSelectedPhoto.deleteMany({
        where: { advertisementId: ad.id, channel: parsed.data.channel },
      }),
      prisma.advertisementSelectedPhoto.createMany({
        data: parsed.data.items.map((item) => ({
          advertisementId: ad.id,
          channel: parsed.data.channel,
          propertyPhotoId: item.propertyPhotoId,
          sortOrder: item.sortOrder,
          isPrimary: Boolean(item.isPrimary),
          excluded: Boolean(item.excluded),
        })),
      }),
    ]);

    const selected = await prisma.advertisementSelectedPhoto.findMany({
      where: { advertisementId: ad.id, channel: parsed.data.channel },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      include: { propertyPhoto: true },
    });

    return NextResponse.json({ items: selected });
  } catch {
    return safeServerError();
  }
}
