import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  dedupeListingPhotos,
  formatPublicAddress,
  getPublicFeatures,
  isPropertyPubliclyAvailable,
  isRentalUnitPubliclyAvailable,
  type ListingPhoto,
} from "@/lib/public-listings";
import { publicCatalogQuerySchema } from "@/lib/validators";

function normalizedQueryParams(input: URLSearchParams) {
  const record: Record<string, string> = {};
  for (const [key, value] of input.entries()) {
    const cleaned = value.trim();
    if (!cleaned) continue;
    record[key] = cleaned;
  }
  return record;
}

function normalizeSort(sort: string) {
  if (sort === "price_desc") return { monthlyPrice: "desc" as const };
  if (sort === "bedrooms_desc") return { bedrooms: "desc" as const };
  if (sort === "availability_soon") return { availableFrom: "asc" as const };
  return { monthlyPrice: "asc" as const };
}

export async function GET(request: NextRequest) {
  const raw = normalizedQueryParams(request.nextUrl.searchParams);
  const parsed = publicCatalogQuerySchema.safeParse(raw);

  const filters = parsed.success
    ? parsed.data
    : publicCatalogQuerySchema.parse({
        sort: "price_asc",
        page: 1,
        pageSize: 24,
      });

  const page = filters.page;
  const pageSize = Math.min(filters.pageSize, 48);
  const skip = (page - 1) * pageSize;

  const keyword = filters.q?.toLowerCase();
  const city = filters.city?.toLowerCase();
  const district = filters.district?.toLowerCase();
  const propertyType = filters.propertyType?.toLowerCase();

  const rentalUnitWhere = {
    status: "AVAILABLE" as const,
    isPubliclyVisible: { not: false as const },
    ...(filters.bedrooms !== undefined ? { bedrooms: filters.bedrooms } : {}),
    ...(filters.maxPrice !== undefined ? { monthlyPrice: { lte: filters.maxPrice } } : {}),
    ...(filters.petsAllowed !== undefined ? { petsAllowed: filters.petsAllowed === "true" } : {}),
    ...(filters.parking !== undefined ? { parking: filters.parking === "true" } : {}),
    ...(filters.availability === "known" ? { availableFrom: { not: null as null | Date } } : {}),
    ...(propertyType ? { propertyType: { contains: propertyType, mode: "insensitive" as const } } : {}),
    ...(city || district || keyword
      ? {
          OR: [
            ...(city ? [{ building: { city: { contains: city, mode: "insensitive" as const } } }] : []),
            ...(district ? [{ building: { district: { contains: district, mode: "insensitive" as const } } }] : []),
            ...(keyword
              ? [
                  { building: { city: { contains: keyword, mode: "insensitive" as const } } },
                  { building: { district: { contains: keyword, mode: "insensitive" as const } } },
                  { propertyType: { contains: keyword, mode: "insensitive" as const } },
                  { publicTitle: { contains: keyword, mode: "insensitive" as const } },
                  { publicDescription: { contains: keyword, mode: "insensitive" as const } },
                  { description: { contains: keyword, mode: "insensitive" as const } },
                  { inclusions: { contains: keyword, mode: "insensitive" as const } },
                ]
              : []),
          ],
        }
      : {}),
  };

  const rentalUnitCount = await prisma.rentalUnit.count({ where: rentalUnitWhere });

  if (rentalUnitCount > 0) {
    const units = await prisma.rentalUnit.findMany({
      where: rentalUnitWhere,
      orderBy: [normalizeSort(filters.sort), { displayOrder: "asc" }, { updatedAt: "desc" }],
      skip,
      take: pageSize,
      include: {
        building: {
          select: {
            address: true,
            city: true,
            district: true,
            photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, description: true } },
            _count: { select: { photos: true } },
          },
        },
        photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, description: true } },
        _count: { select: { photos: true } },
      },
    });

    const items = units
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
        const photoList: ListingPhoto[] = dedupeListingPhotos([
          ...(unit.photos[0] ? [{ url: unit.photos[0].url, description: unit.photos[0].description, category: "UNIT" as const }] : []),
          ...(unit.building.photos[0]
            ? [{ url: unit.building.photos[0].url, description: unit.building.photos[0].description, category: "BUILDING" as const }]
            : []),
        ]);

        return {
          id: unit.id,
          address: formatPublicAddress(unit.building.address),
          city: unit.building.city,
          district: unit.building.district,
          monthlyPrice: unit.monthlyPrice,
          bedrooms: unit.bedrooms,
          propertyType: unit.propertyType,
          availableFrom: unit.availableFrom,
          imageUrl: unit.primaryPhotoUrl || photoList[0]?.url || null,
          photoCount: unit._count.photos + unit.building._count.photos,
          petsAllowed: unit.petsAllowed,
          parking: unit.parking,
          inclusions: unit.inclusions,
          features: getPublicFeatures({
            petsAllowed: unit.petsAllowed,
            parking: unit.parking,
            inclusions: unit.inclusions,
          }),
        };
      });

    const totalPages = Math.max(1, Math.ceil(rentalUnitCount / pageSize));

    return NextResponse.json({
      items,
      total: rentalUnitCount,
      page,
      pageSize,
      totalPages,
      filters,
    });
  }

  const propertyWhere = {
    status: "AVAILABLE" as const,
    ...(filters.bedrooms !== undefined ? { bedrooms: filters.bedrooms } : {}),
    ...(filters.maxPrice !== undefined ? { monthlyPrice: { lte: filters.maxPrice } } : {}),
    ...(filters.petsAllowed !== undefined ? { petsAllowed: filters.petsAllowed === "true" } : {}),
    ...(filters.parking !== undefined ? { parking: filters.parking === "true" } : {}),
    ...(filters.availability === "known" ? { availableFrom: { not: null as null | Date } } : {}),
    ...(propertyType ? { propertyType: { contains: propertyType, mode: "insensitive" as const } } : {}),
    ...(city || district || keyword
      ? {
          OR: [
            ...(city ? [{ city: { contains: city, mode: "insensitive" as const } }] : []),
            ...(district ? [{ district: { contains: district, mode: "insensitive" as const } }] : []),
            ...(keyword
              ? [
                  { city: { contains: keyword, mode: "insensitive" as const } },
                  { district: { contains: keyword, mode: "insensitive" as const } },
                  { propertyType: { contains: keyword, mode: "insensitive" as const } },
                  { descriptionFr: { contains: keyword, mode: "insensitive" as const } },
                  { inclusions: { contains: keyword, mode: "insensitive" as const } },
                ]
              : []),
          ],
        }
      : {}),
  };

  const total = await prisma.property.count({ where: propertyWhere });
  const properties = await prisma.property.findMany({
    where: propertyWhere,
    orderBy: [normalizeSort(filters.sort), { marketingPriority: "desc" }, { updatedAt: "desc" }],
    skip,
    take: pageSize,
    include: {
      photos: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, description: true } },
      _count: { select: { photos: true } },
    },
  });

  const items = properties
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
      id: property.id,
      address: formatPublicAddress(property.address),
      city: property.city,
      district: property.district,
      monthlyPrice: property.monthlyPrice,
      bedrooms: property.bedrooms,
      propertyType: property.propertyType,
      availableFrom: property.availableFrom,
      imageUrl: property.photos[0]?.url ?? null,
      photoCount: property._count.photos,
      petsAllowed: property.petsAllowed,
      parking: property.parking,
      inclusions: property.inclusions,
      features: getPublicFeatures({
        petsAllowed: property.petsAllowed,
        parking: property.parking,
        inclusions: property.inclusions,
      }),
    }));

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages,
    filters,
  });
}
