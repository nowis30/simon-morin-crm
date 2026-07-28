import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { normalizePhotoLinks } from "@/lib/storage";
import { propertyCreateSchema } from "@/lib/validators";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    const payload = await request.json();
    const parsed = propertyCreateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const item = parsed.data;

    await prisma.propertyPhoto.deleteMany({ where: { propertyId: id } });

    const updated = await prisma.property.update({
      where: { id },
      data: {
        codeIsr: cleanText(item.codeIsr),
        address: cleanText(item.address),
        city: cleanText(item.city),
        district: cleanText(item.district),
        monthlyPrice: item.monthlyPrice,
        propertyType: cleanText(item.propertyType),
        bedrooms: item.bedrooms,
        availableFrom: item.availableFrom ? new Date(item.availableFrom) : null,
        petsAllowed: item.petsAllowed,
        petsDetails: cleanText(item.petsDetails),
        parking: item.parking,
        inclusions: cleanText(item.inclusions),
        descriptionFr: cleanText(item.descriptionFr),
        descriptionEn: cleanText(item.descriptionEn),
        gestionIsrUrl: item.gestionIsrUrl || null,
        marketplaceUrl: item.marketplaceUrl || null,
        facebookPostUrl: item.facebookPostUrl || null,
        marketingPriority: item.marketingPriority,
        lastVerificationDate: item.lastVerificationDate ? new Date(item.lastVerificationDate) : null,
        status: item.status,
        photos: { create: normalizePhotoLinks(item.photoLinks) },
      },
      include: { photos: true },
    });

    await writeAuditLog({ userId: auth.user!.id, entity: "Property", entityId: id, action: "UPDATE" });

    return NextResponse.json({ item: updated });
  } catch {
    return safeServerError();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    const archived = await prisma.property.update({
      where: { id },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
      },
    });

    await writeAuditLog({ userId: auth.user!.id, entity: "Property", entityId: id, action: "ARCHIVE" });

    return NextResponse.json({ item: archived });
  } catch {
    return safeServerError();
  }
}
