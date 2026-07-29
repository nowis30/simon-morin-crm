import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatPublicAddress, getPublicFeatures, getPublicVisibilityForRentalUnit, isPublicPropertyVisible } from "@/lib/public-listings";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rentalUnit = await prisma.rentalUnit.findUnique({
    where: { id },
    include: { building: true, photos: { orderBy: { sortOrder: "asc" } } },
  });

  if (rentalUnit) {
    if (!getPublicVisibilityForRentalUnit({ status: rentalUnit.status, isPubliclyVisible: rentalUnit.isPubliclyVisible })) {
      return NextResponse.json({ error: "Ce logement n’est plus disponible — voir les logements semblables." }, { status: 200 });
    }

    return NextResponse.json({
      item: {
        id: rentalUnit.id,
        codeIsr: rentalUnit.codeIsr,
        address: formatPublicAddress(rentalUnit.building.address),
        city: rentalUnit.building.city,
        district: rentalUnit.building.district,
        monthlyPrice: rentalUnit.monthlyPrice,
        bedrooms: rentalUnit.bedrooms,
        propertyType: rentalUnit.propertyType,
        status: rentalUnit.status,
        description: rentalUnit.publicDescription || rentalUnit.description,
        availableFrom: rentalUnit.availableFrom,
        petsAllowed: rentalUnit.petsAllowed,
        parking: rentalUnit.parking,
        inclusions: rentalUnit.inclusions,
        photos: [rentalUnit.primaryPhotoUrl, ...rentalUnit.photos.map((photo) => photo.url)].filter(Boolean) as string[],
        features: getPublicFeatures({
          petsAllowed: rentalUnit.petsAllowed,
          parking: rentalUnit.parking,
          inclusions: rentalUnit.inclusions,
        }),
      },
    });
  }

  const property = await prisma.property.findUnique({
    where: { id },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  });

  if (!property || !isPublicPropertyVisible(property.status)) {
    return NextResponse.json({ error: "Ce logement n’est plus disponible — voir les logements semblables." }, { status: 200 });
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
