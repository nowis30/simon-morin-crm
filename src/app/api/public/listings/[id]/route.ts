import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatPublicAddress, getPublicFeatures, isPublicPropertyVisible } from "@/lib/public-listings";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  });

  if (!property || !isPublicPropertyVisible(property.status)) {
    return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    item: {
      id: property.id,
      codeIsr: property.codeIsr,
      address: formatPublicAddress(property.address),
      city: property.city,
      district: property.district,
      monthlyPrice: property.monthlyPrice,
      bedrooms: property.bedrooms,
      propertyType: property.propertyType,
      status: property.status,
      description: property.descriptionFr,
      availableFrom: property.availableFrom,
      petsAllowed: property.petsAllowed,
      parking: property.parking,
      inclusions: property.inclusions,
      photos: property.photos.map((photo) => photo.url),
      features: getPublicFeatures({
        petsAllowed: property.petsAllowed,
        parking: property.parking,
        inclusions: property.inclusions,
      }),
    },
  });
}
