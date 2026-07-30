import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dedupeListingPhotos, formatPublicAddress, getPublicFeatures, isPropertyPubliclyAvailable, isRentalUnitPubliclyAvailable, type ListingPhoto } from "@/lib/public-listings";

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
        .filter((unit) =>
          isRentalUnitPubliclyAvailable({
            status: unit.status,
            isPubliclyVisible: unit.isPubliclyVisible,
            address: unit.building.address,
            city: unit.building.city,
            monthlyPrice: unit.monthlyPrice,
            propertyType: unit.propertyType,
            bedrooms: unit.bedrooms,
            description: unit.publicDescription || unit.description,
          }),
        )
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
            address: formatPublicAddress(unit.building.address),
            city: unit.building.city,
            district: unit.building.district,
            monthlyPrice: unit.monthlyPrice,
            bedrooms: unit.bedrooms,
            propertyType: unit.propertyType,
            imageUrl: unit.primaryPhotoUrl || galleryPhotos[0]?.url || null,
            photoCount: galleryPhotos.length,
            petsAllowed: unit.petsAllowed,
            parking: unit.parking,
            inclusions: unit.inclusions,
            features: getPublicFeatures({
              petsAllowed: unit.petsAllowed,
              parking: unit.parking,
              inclusions: unit.inclusions,
            }),
          };
        })
    : await prisma.property.findMany({
        where: { status: { notIn: ["RENTED", "REMOVED", "ARCHIVED"] } },
        orderBy: [{ marketingPriority: "desc" }, { monthlyPrice: "asc" }],
        take: 12,
        include: { photos: { orderBy: { sortOrder: "asc" }, take: 12 } },
      }).then((properties) =>
        properties
          .filter((property) =>
            isPropertyPubliclyAvailable({
              status: property.status,
              address: property.address,
              city: property.city,
              monthlyPrice: property.monthlyPrice,
              propertyType: property.propertyType,
              bedrooms: property.bedrooms,
              description: property.descriptionFr,
            }),
          )
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
              address: formatPublicAddress(property.address),
              city: property.city,
              district: property.district,
              monthlyPrice: property.monthlyPrice,
              bedrooms: property.bedrooms,
              propertyType: property.propertyType,
              imageUrl: galleryPhotos[0]?.url ?? null,
              photoCount: galleryPhotos.length,
              petsAllowed: property.petsAllowed,
              parking: property.parking,
              inclusions: property.inclusions,
              features: getPublicFeatures({
                petsAllowed: property.petsAllowed,
                parking: property.parking,
                inclusions: property.inclusions,
              }),
            };
          }),
      );

  return NextResponse.json({ items });
}
