import { PropertyStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { normalizePhotoLinks } from "@/lib/storage";
import { propertyCreateSchema, propertyFilterSchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = propertyFilterSchema.parse(params);

    const properties = await prisma.property.findMany({
      where: {
        status: filters.status ? (filters.status as PropertyStatus) : undefined,
        city: filters.city ? { contains: filters.city, mode: "insensitive" } : undefined,
        district: filters.district ? { contains: filters.district, mode: "insensitive" } : undefined,
        monthlyPrice: {
          gte: filters.minPrice,
          lte: filters.maxPrice,
        },
        bedrooms: filters.bedrooms,
        OR: filters.query
          ? [
              { address: { contains: filters.query, mode: "insensitive" } },
              { codeIsr: { contains: filters.query, mode: "insensitive" } },
            ]
          : undefined,
      },
      include: { photos: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ marketingPriority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ items: properties });
  } catch {
    return safeServerError();
  }
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

    const payload = await request.json();
    const parsed = propertyCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const item = parsed.data;
    const created = await prisma.property.create({
      data: {
        codeIsr: cleanText(item.codeIsr),
        address: cleanText(item.address),
        city: cleanText(item.city),
        district: cleanText(item.district),
        monthlyPrice: item.monthlyPrice,
        propertyType: cleanText(item.propertyType),
        bedrooms: item.bedrooms,
        availableFrom: item.availableFrom ? new Date(item.availableFrom) : undefined,
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
        lastVerificationDate: item.lastVerificationDate ? new Date(item.lastVerificationDate) : undefined,
        status: item.status,
        photos: {
          create: normalizePhotoLinks(item.photoLinks),
        },
      },
      include: { photos: true },
    });

    await writeAuditLog({
      userId: auth.user!.id,
      entity: "Property",
      entityId: created.id,
      action: "CREATE",
      metadata: { codeIsr: created.codeIsr },
    });

    return NextResponse.json({ item: created }, { status: 201 });
  } catch {
    return safeServerError();
  }
}
