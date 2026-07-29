import { createHash } from "node:crypto";
import { PropertyStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { buildSyncComparisonReport, buildSyncSnapshot, getCodesToFlagAsVerify } from "@/lib/gestion-isr-sync";
import {
  fetchGestionIsrListings,
  inferGestionIsrMetadata,
  normalizeGestionIsrUnitStatus,
  selectGestionIsrCodesToRemove,
} from "@/integrations/gestion-isr/importer";

const DEFAULT_GESTION_ISR_URL = "https://location.gestion-isr.com/";

function buildEntityCode(prefix: string, seed: string) {
  const normalizedSeed = seed.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 8).toUpperCase();
  return `${prefix}-${normalizedSeed || hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const payload = (await request.json().catch(() => ({}))) as { url?: string };
    const sourceUrl = payload.url?.trim() || process.env.GESTION_ISR_LISTINGS_URL || DEFAULT_GESTION_ISR_URL;

    const listings = await fetchGestionIsrListings(sourceUrl);
    if (!listings.length) {
      return NextResponse.json({ error: "Aucun logement detecte sur la page Gestion ISR" }, { status: 422 });
    }

    const existingProperties = await prisma.property.findMany({
      where: {
        gestionIsrUrl: { not: null },
      },
      select: {
        codeIsr: true,
        gestionIsrUrl: true,
        status: true,
      },
    });

    const existingPropertiesFull = await prisma.property.findMany({
      where: { gestionIsrUrl: { not: null } },
      include: { photos: { select: { url: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { codeIsr: "asc" },
    });

    let added = 0;
    let updated = 0;

    for (const listing of listings) {
      const metadata = inferGestionIsrMetadata(listing.descriptionFr);
      const statusInfo = normalizeGestionIsrUnitStatus(listing.sourceStatus || listing.statusLabel);
      const alreadyExists = await prisma.property.findUnique({
        where: { codeIsr: listing.codeIsr },
        select: { id: true },
      });

      const item = await prisma.$transaction(async (tx) => {
        const buildingCode = buildEntityCode("BLDG", listing.buildingId || listing.sourceId || listing.codeIsr);
        const unitCode = buildEntityCode("UNIT", listing.unitId || listing.codeIsr);

        const building = await tx.building.upsert({
          where: { codeIsr: buildingCode },
          update: {
            address: cleanText(listing.address),
            city: cleanText(listing.city),
            district: cleanText(listing.district) || null,
            description: cleanText(listing.descriptionFr).slice(0, 2000) || null,
            gestionIsrUrl: listing.listingUrl || sourceUrl,
          },
          create: {
            codeIsr: buildingCode,
            address: cleanText(listing.address),
            city: cleanText(listing.city),
            district: cleanText(listing.district) || null,
            description: cleanText(listing.descriptionFr).slice(0, 2000) || null,
            gestionIsrUrl: listing.listingUrl || sourceUrl,
          },
        });

        const rentalUnit = await tx.rentalUnit.upsert({
          where: { codeIsr: unitCode },
          update: {
            buildingId: building.id,
            unitNumber: cleanText(listing.unitNumber) || null,
            floor: cleanText(listing.floor) || null,
            monthlyPrice: listing.monthlyPrice,
            bedrooms: listing.bedrooms,
            propertyType: cleanText(listing.propertyType),
            description: cleanText(listing.descriptionFr).slice(0, 4000) || "",
            status: statusInfo.normalizedStatus as PropertyStatus,
            petsAllowed: metadata.petsAllowed,
            petsDetails: cleanText(metadata.petsDetails) || null,
            parking: metadata.parking,
            inclusions: cleanText(metadata.inclusions) || null,
            availableFrom: listing.availableFrom ? new Date(listing.availableFrom) : null,
            gestionIsrUrl: listing.listingUrl || sourceUrl,
          },
          create: {
            codeIsr: unitCode,
            buildingId: building.id,
            unitNumber: cleanText(listing.unitNumber) || null,
            floor: cleanText(listing.floor) || null,
            monthlyPrice: listing.monthlyPrice,
            bedrooms: listing.bedrooms,
            propertyType: cleanText(listing.propertyType),
            description: cleanText(listing.descriptionFr).slice(0, 4000) || "",
            status: statusInfo.normalizedStatus as PropertyStatus,
            petsAllowed: metadata.petsAllowed,
            petsDetails: cleanText(metadata.petsDetails) || null,
            parking: metadata.parking,
            inclusions: cleanText(metadata.inclusions) || null,
            availableFrom: listing.availableFrom ? new Date(listing.availableFrom) : null,
            gestionIsrUrl: listing.listingUrl || sourceUrl,
          },
        });

        await tx.buildingPhoto.deleteMany({ where: { buildingId: building.id } });
        if (listing.photoUrls.length > 0) {
          await tx.buildingPhoto.createMany({
            data: listing.photoUrls.map((url, index) => ({
              buildingId: building.id,
              url,
              sortOrder: index,
              description: "Photo importee Gestion ISR",
            })),
          });
        }

        await tx.rentalUnitPhoto.deleteMany({ where: { rentalUnitId: rentalUnit.id } });
        if (listing.photoUrls.length > 0) {
          await tx.rentalUnitPhoto.createMany({
            data: listing.photoUrls.map((url, index) => ({
              rentalUnitId: rentalUnit.id,
              url,
              sortOrder: index,
              description: "Photo importee Gestion ISR",
            })),
          });
        }

        const property = await tx.property.upsert({
          where: { codeIsr: listing.codeIsr },
          update: {
            address: cleanText(listing.address),
            city: cleanText(listing.city),
            district: cleanText(listing.district) || null,
            monthlyPrice: listing.monthlyPrice,
            propertyType: cleanText(listing.propertyType),
            bedrooms: listing.bedrooms,
            petsAllowed: metadata.petsAllowed,
            petsDetails: cleanText(metadata.petsDetails) || null,
            parking: metadata.parking,
            inclusions: cleanText(metadata.inclusions) || null,
            descriptionFr: cleanText(listing.descriptionFr),
            descriptionEn: "English description pending translation",
            gestionIsrUrl: listing.listingUrl || sourceUrl,
            status: statusInfo.normalizedStatus as PropertyStatus,
            buildingId: building.id,
            rentalUnitId: rentalUnit.id,
            lastVerificationDate: new Date(),
            archivedAt: null,
          },
          create: {
            codeIsr: listing.codeIsr,
            address: cleanText(listing.address),
            city: cleanText(listing.city),
            district: cleanText(listing.district) || null,
            monthlyPrice: listing.monthlyPrice,
            propertyType: cleanText(listing.propertyType),
            bedrooms: listing.bedrooms,
            petsAllowed: metadata.petsAllowed,
            petsDetails: cleanText(metadata.petsDetails) || null,
            parking: metadata.parking,
            inclusions: cleanText(metadata.inclusions) || null,
            descriptionFr: cleanText(listing.descriptionFr),
            descriptionEn: "English description pending translation",
            gestionIsrUrl: listing.listingUrl || sourceUrl,
            status: statusInfo.normalizedStatus as PropertyStatus,
            buildingId: building.id,
            rentalUnitId: rentalUnit.id,
            lastVerificationDate: new Date(),
          },
        });

        await tx.propertyPhoto.deleteMany({ where: { propertyId: property.id } });
        if (listing.photoUrls.length > 0) {
          await tx.propertyPhoto.createMany({
            data: listing.photoUrls.map((url, index) => ({
              propertyId: property.id,
              url,
              sortOrder: index,
              description: "Photo importee Gestion ISR",
            })),
          });
        }

        return property.id;
      });

      if (alreadyExists) {
        updated += 1;
      } else {
        added += 1;
      }
    }

    const codesToVerify = getCodesToFlagAsVerify(
      existingPropertiesFull.map((property) => property.codeIsr),
      listings.map((listing) => listing.codeIsr),
    );

    const verificationResult = codesToVerify.length
      ? await prisma.property.updateMany({
          where: { codeIsr: { in: codesToVerify } },
          data: {
            status: "TO_VERIFY",
            lastVerificationDate: new Date(),
          },
        })
      : { count: 0 };

    const currentProperties = await prisma.property.findMany({
      where: { gestionIsrUrl: { not: null } },
      include: { photos: { select: { url: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { codeIsr: "asc" },
    });
    const previousSnapshot = buildSyncSnapshot(existingPropertiesFull);
    const comparison = buildSyncComparisonReport(currentProperties, previousSnapshot);

    const codesToRemove = selectGestionIsrCodesToRemove({
      existingProperties,
      liveListings: listings,
      sourceUrl,
    });

    await writeAuditLog({
      userId: auth.user!.id,
      entity: "Property",
      entityId: "sync-gestion-isr",
      action: "SYNC_GESTION_ISR",
      metadata: {
        sourceUrl,
        added,
        updated,
        flaggedToVerify: verificationResult.count,
        totalFetched: listings.length,
        missingCodes: codesToVerify,
        previousRemovalCandidates: codesToRemove,
        comparison,
        snapshot: buildSyncSnapshot(currentProperties),
      },
    });

    return NextResponse.json({
      ok: true,
      sourceUrl,
      added,
      updated,
      removed: 0,
      flaggedToVerify: verificationResult.count,
      totalFetched: listings.length,
      comparison,
    });
  } catch {
    return safeServerError();
  }
}
