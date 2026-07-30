import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { isPropertyPubliclyAvailable, isRentalUnitPubliclyAvailable } from "@/lib/public-listings";
import { getPublicAppUrl } from "@/lib/public-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getPublicAppUrl();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/logements`,
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/contact`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  const rentalUnits = await prisma.rentalUnit.findMany({
    include: {
      building: {
        select: {
          address: true,
          city: true,
        },
      },
    },
  });

  const rentalUnitEntries: MetadataRoute.Sitemap = rentalUnits
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
    .map((unit) => ({
      url: `${baseUrl}/logements/${unit.id}`,
      changeFrequency: "daily",
      priority: 0.8,
      lastModified: unit.updatedAt,
    }));

  const properties = await prisma.property.findMany();
  const propertyEntries: MetadataRoute.Sitemap = properties
    .filter((property) => !property.rentalUnitId)
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
    .map((property) => ({
      url: `${baseUrl}/logements/${property.id}`,
      changeFrequency: "daily",
      priority: 0.7,
      lastModified: property.updatedAt,
    }));

  return [...staticPages, ...rentalUnitEntries, ...propertyEntries];
}
