import { NextResponse } from "next/server";
import { buildMarketplacePublicText } from "@/lib/marketplace-package";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET(_: Request, { params }: { params: Promise<{ advertisementId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const { advertisementId } = await params;
    const ad = await prisma.advertisement.findUnique({
      where: { id: advertisementId },
      include: {
        property: { include: { photos: { orderBy: { sortOrder: "asc" } } } },
        selectedPhotos: {
          where: { channel: "MARKETPLACE", excluded: false },
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
        },
      },
    });

    if (!ad || !ad.property) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    const preview = buildMarketplacePublicText({
      advertisementId: ad.id,
      advertisementStatus: ad.status,
      title: ad.title,
      body: ad.body,
      property: {
        id: ad.property.id,
        rentalUnitId: ad.property.rentalUnitId,
        codeIsr: ad.property.codeIsr,
        address: ad.property.address,
        city: ad.property.city,
        district: ad.property.district,
        monthlyPrice: ad.property.monthlyPrice,
        bedrooms: ad.property.bedrooms,
        propertyType: ad.property.propertyType,
        petsAllowed: ad.property.petsAllowed,
        petsDetails: ad.property.petsDetails,
        parking: ad.property.parking,
        inclusions: ad.property.inclusions,
        availableFrom: ad.property.availableFrom,
        status: ad.property.status,
        photos: ad.property.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          description: photo.description,
          sortOrder: photo.sortOrder,
        })),
      },
      selectedPhotos: ad.selectedPhotos,
    });

    return NextResponse.json({
      item: {
        advertisementId: ad.id,
        title: ad.title,
        status: ad.status,
        property: {
          id: ad.property.id,
          rentalUnitId: ad.property.rentalUnitId,
          city: ad.property.city,
          district: ad.property.district,
          monthlyPrice: ad.property.monthlyPrice,
          bedrooms: ad.property.bedrooms,
          propertyType: ad.property.propertyType,
          inclusions: ad.property.inclusions,
          petsAllowed: ad.property.petsAllowed,
          petsDetails: ad.property.petsDetails,
          parking: ad.property.parking,
          availableFrom: ad.property.availableFrom,
          status: ad.property.status,
        },
        publicUrl: preview.publicUrl,
        generatedText: preview.text,
        photos: ad.property.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          description: photo.description,
          sortOrder: photo.sortOrder,
        })),
        selectedPhotoIds: ad.selectedPhotos.map((photo) => photo.propertyPhotoId),
      },
    });
  } catch {
    return safeServerError();
  }
}
