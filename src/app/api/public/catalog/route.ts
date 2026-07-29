import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatPublicAddress, getPublicFeatures, getPublicVisibilityForRentalUnit, isPublicPropertyVisible } from "@/lib/public-listings";

export async function GET() {
  const rentalUnits = await prisma.rentalUnit.findMany({
    where: { status: { notIn: ["RENTED", "REMOVED", "ARCHIVED"] } },
    orderBy: [{ displayOrder: "asc" }, { monthlyPrice: "asc" }],
    take: 12,
    include: {
      building: true,
      photos: { orderBy: { sortOrder: "asc" }, take: 6 },
    },
  });

  const items = rentalUnits.length
    ? rentalUnits
        .filter((unit) => getPublicVisibilityForRentalUnit({ status: unit.status, isPubliclyVisible: unit.isPubliclyVisible }))
        .map((unit) => ({
          id: unit.id,
          codeIsr: unit.codeIsr,
          address: formatPublicAddress(unit.building.address),
          city: unit.building.city,
          district: unit.building.district,
          monthlyPrice: unit.monthlyPrice,
          bedrooms: unit.bedrooms,
          propertyType: unit.propertyType,
          status: unit.status,
          imageUrl: unit.primaryPhotoUrl || unit.photos[0]?.url || null,
          features: getPublicFeatures({
            petsAllowed: unit.petsAllowed,
            parking: unit.parking,
            inclusions: unit.inclusions,
          }),
          building: unit.building ? { name: unit.building.name, address: unit.building.address, city: unit.building.city, district: unit.building.district } : null,
          rentalUnit: { unitNumber: unit.unitNumber, floor: unit.floor },
        }))
    : await prisma.property.findMany({
        where: { status: { notIn: ["RENTED", "REMOVED", "ARCHIVED"] } },
        orderBy: [{ marketingPriority: "desc" }, { monthlyPrice: "asc" }],
        take: 12,
        include: { photos: { orderBy: { sortOrder: "asc" }, take: 6 } },
      }).then((properties) =>
        properties
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
      );

  return NextResponse.json({ items });
}
