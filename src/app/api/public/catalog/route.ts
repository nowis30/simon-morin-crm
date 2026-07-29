import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dedupeListingPhotos, formatPublicAddress, getPublicFeatures, getPublicVisibilityForRentalUnit, isPublicPropertyVisible, type ListingPhoto } from "@/lib/public-listings";

export async function GET() {
  const rentalUnits = await prisma.rentalUnit.findMany({
    where: { status: { notIn: ["RENTED", "REMOVED", "ARCHIVED"] } },
    orderBy: [{ displayOrder: "asc" }, { monthlyPrice: "asc" }],
    take: 12,
    include: {
      building: { include: { photos: { orderBy: { sortOrder: "asc" }, take: 12 } } },
      photos: { orderBy: { sortOrder: "asc" }, take: 12 },
    },
  });

  const items = rentalUnits.length
    ? rentalUnits
        .filter((unit) => getPublicVisibilityForRentalUnit({ status: unit.status, isPubliclyVisible: unit.isPubliclyVisible }))
        .map((unit) => {
          const unitPhotos: ListingPhoto[] = unit.photos.map((photo) => ({
            url: photo.url,
            description: photo.description,
            category: "UNIT",
          }));
          const buildingPhotos: ListingPhoto[] = (unit.building?.photos ?? []).map((photo) => ({
            url: photo.url,
            description: photo.description,
            category: "BUILDING",
          }));
          const galleryPhotos = dedupeListingPhotos([...unitPhotos, ...buildingPhotos]);

          return {
            id: unit.id,
            codeIsr: unit.codeIsr,
            address: formatPublicAddress(unit.building.address),
            city: unit.building.city,
            district: unit.building.district,
            monthlyPrice: unit.monthlyPrice,
            bedrooms: unit.bedrooms,
            propertyType: unit.propertyType,
            status: unit.status,
            imageUrl: unit.primaryPhotoUrl || galleryPhotos[0]?.url || null,
            photoCount: galleryPhotos.length,
            features: getPublicFeatures({
              petsAllowed: unit.petsAllowed,
              parking: unit.parking,
              inclusions: unit.inclusions,
            }),
            building: unit.building ? { name: unit.building.name, address: unit.building.address, city: unit.building.city, district: unit.building.district } : null,
            rentalUnit: { unitNumber: unit.unitNumber, floor: unit.floor },
          };
        })
    : await prisma.property.findMany({
        where: { status: { notIn: ["RENTED", "REMOVED", "ARCHIVED"] } },
        orderBy: [{ marketingPriority: "desc" }, { monthlyPrice: "asc" }],
        take: 12,
        include: { photos: { orderBy: { sortOrder: "asc" }, take: 12 } },
      }).then((properties) =>
        properties
          .filter((property) => isPublicPropertyVisible(property.status))
          .map((property) => {
            const galleryPhotos = dedupeListingPhotos(
              property.photos.map((photo) => ({
                url: photo.url,
                description: photo.description,
                category: "UNKNOWN" as const,
              })),
            );

            return {
              id: property.id,
              codeIsr: property.codeIsr,
              address: formatPublicAddress(property.address),
              city: property.city,
              district: property.district,
              monthlyPrice: property.monthlyPrice,
              bedrooms: property.bedrooms,
              propertyType: property.propertyType,
              status: property.status,
              imageUrl: galleryPhotos[0]?.url ?? null,
              photoCount: galleryPhotos.length,
              features: getPublicFeatures({
                petsAllowed: property.petsAllowed,
                parking: property.parking,
                inclusions: property.inclusions,
              }),
              building: null,
              rentalUnit: null,
            };
          }),
      );

  return NextResponse.json({ items });
}
