import { AdvertisementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfRequest } from "@/lib/csrf";
import { buildMarketplaceZipPackage, isPropertyAvailableForMarketplace } from "@/lib/marketplace-package";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { marketplacePackageSchema } from "@/lib/validators";

export async function POST(request: NextRequest, { params }: { params: Promise<{ advertisementId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { advertisementId } = await params;
    const body = await request.json();
    const parsed = marketplacePackageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

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

    if (!isPropertyAvailableForMarketplace(ad.property.status)) {
      return NextResponse.json({ error: "Le logement n'est plus disponible." }, { status: 400 });
    }

    const record = {
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
    };

    try {
      const packageResult = await buildMarketplaceZipPackage({
        record,
        orderedPhotoIds: parsed.data.orderedPhotoIds,
        finalText: parsed.data.finalText,
      });

      await prisma.advertisementPublication.create({
        data: {
          advertisementId: ad.id,
          channel: "MARKETPLACE",
          status: AdvertisementStatus.MANUAL_ACTION_REQUIRED,
          destination: packageResult.publicUrl,
          checklist: {
            packageCreatedAt: new Date().toISOString(),
            selectedPhotoCount: packageResult.selectedPhotoCount,
            addedPhotoCount: packageResult.addedPhotoCount,
            textFingerprint: packageResult.textFingerprint,
            fileName: packageResult.fileName,
          },
          idempotencyKey: `marketplace-package-${ad.id}-${Date.now()}`,
          errorMessage: packageResult.hasPhotoWarning ? "Une ou plusieurs photos n'ont pas pu etre ajoutees au kit." : null,
        },
      });

      await prisma.advertisement.update({
        where: { id: ad.id },
        data: {
          status: AdvertisementStatus.MANUAL_ACTION_REQUIRED,
          publicationChannel: "MARKETPLACE",
          requiresManualAction: true,
        },
      });

      await writeAuditLog({
        userId: auth.user!.id,
        entity: "Advertisement",
        entityId: ad.id,
        action: "MARKETPLACE_PACKAGE_CREATED",
        metadata: {
          advertisementId: ad.id,
          propertyId: ad.property.id,
          rentalUnitId: ad.property.rentalUnitId,
          photoCount: packageResult.addedPhotoCount,
          selectedPhotoCount: packageResult.selectedPhotoCount,
          textFingerprint: packageResult.textFingerprint,
          success: true,
          partialPhotoFailure: packageResult.hasPhotoWarning,
        },
      });

      return new NextResponse(new Uint8Array(packageResult.zipBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename=\"${packageResult.fileName}\"`,
          "Cache-Control": "no-store",
          "x-marketplace-photo-warning": packageResult.hasPhotoWarning ? "1" : "0",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Le kit Marketplace n'a pas pu etre cree.";
      await writeAuditLog({
        userId: auth.user!.id,
        entity: "Advertisement",
        entityId: ad.id,
        action: "MARKETPLACE_PACKAGE_CREATED",
        metadata: {
          advertisementId: ad.id,
          propertyId: ad.property.id,
          rentalUnitId: ad.property.rentalUnitId,
          photoCount: 0,
          success: false,
          error: message,
        },
      });

      const mappedMessage =
        message.includes("Aucune photo")
          ? "Aucune photo n'a ete selectionnee."
          : message.includes("depasse la taille")
            ? "Une photo depasse la taille permise."
            : message.includes("plus disponible")
              ? "Le logement n'est plus disponible."
              : message.includes("texte")
                ? "Le texte de l'annonce est vide."
                : "Le kit Marketplace n'a pas pu etre cree.";

      return NextResponse.json({ error: mappedMessage }, { status: 400 });
    }
  } catch {
    return safeServerError();
  }
}
