import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatPublicAddress, getPublicFeatures, isPublicPropertyVisible } from "@/lib/public-listings";

export async function GET() {
  const properties = await prisma.property.findMany({
    where: { status: { notIn: ["RENTED", "REMOVED", "ARCHIVED"] } },
    orderBy: [{ marketingPriority: "desc" }, { monthlyPrice: "asc" }],
    take: 12,
    include: { photos: { orderBy: { sortOrder: "asc" }, take: 6 } },
  });

  return NextResponse.json({
    items: properties
      .filter((property) => isPublicPropertyVisible(property.status))
      .map((property) => ({
        id: property.id,
        codeIsr: property.codeIsr,
        address: formatPublicAddress(property.address),
        city: property.city,
        district: property.district,
        monthlyPrice: property.monthlyPrice,
        bedrooms: property.bedrooms,
        propertyType: property.propertyType,
        status: property.status,
        imageUrl: property.photos[0]?.url ?? null,
        features: getPublicFeatures({
          petsAllowed: property.petsAllowed,
          parking: property.parking,
          inclusions: property.inclusions,
        }),
        building: null,
        rentalUnit: null,
      })),
  });
}
