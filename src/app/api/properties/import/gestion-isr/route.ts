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
  selectGestionIsrCodesToRemove,
} from "@/integrations/gestion-isr/importer";

const DEFAULT_GESTION_ISR_URL = "https://location.gestion-isr.com/";

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
      const alreadyExists = await prisma.property.findUnique({
        where: { codeIsr: listing.codeIsr },
        select: { id: true },
      });

      const item = await prisma.property.upsert({
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
          status: "AVAILABLE",
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
          status: "AVAILABLE",
          lastVerificationDate: new Date(),
        },
      });

      await prisma.propertyPhoto.deleteMany({ where: { propertyId: item.id } });
      if (listing.photoUrls.length > 0) {
        await prisma.propertyPhoto.createMany({
          data: listing.photoUrls.map((url, index) => ({
            propertyId: item.id,
            url,
            sortOrder: index,
            description: "Photo importee Gestion ISR",
          })),
        });
      }

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
