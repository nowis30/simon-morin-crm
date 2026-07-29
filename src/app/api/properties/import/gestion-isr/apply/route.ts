import { createHash } from "node:crypto";
import { PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { fetchGestionIsrListings, inferGestionIsrMetadata, normalizeGestionIsrUnitStatus } from "@/integrations/gestion-isr/importer";

const DEFAULT_GESTION_ISR_URL = "https://location.gestion-isr.com/";
const PREVIEW_TTL_MINUTES = 30;

function buildEntityCode(prefix: string, seed: string) {
  const normalizedSeed = seed.replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const hash = createHash("sha1").update(seed).digest("hex").slice(0, 8).toUpperCase();
  return `${prefix}-${normalizedSeed || hash}`;
}

function buildPreviewHash(sourceUrl: string, listings: unknown[]) {
  const normalized = listings
    .map((listing) => ({
      ...(listing as Record<string, unknown>),
      photoUrls: (listing as Record<string, unknown>).photoUrls,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha1").update(JSON.stringify({ sourceUrl, listings: normalized })).digest("hex");
}

function dedupeUrls(urls: Array<string | undefined | null>) {
  return Array.from(new Set(urls.filter(Boolean) as string[]));
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const payload = (await request.json().catch(() => ({}))) as { previewId?: string; url?: string };
    if (!payload.previewId) {
      return NextResponse.json({ error: "Identifiant de previsualisation requis" }, { status: 400 });
    }

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const sourceUrl = payload.url?.trim() || process.env.GESTION_ISR_LISTINGS_URL || DEFAULT_GESTION_ISR_URL;
    const listings = await fetchGestionIsrListings(sourceUrl);
    const expectedHash = buildPreviewHash(sourceUrl, listings);
    const preview = await prisma.gestionIsrSyncPreview.findUnique({ where: { id: payload.previewId } });
    if (!preview) {
      return NextResponse.json({ error: "Previsualisation introuvable" }, { status: 404 });
    }
    if (preview.status === "APPLIED") {
      return NextResponse.json({ ok: true, previewId: preview.id, sourceUrl, applied: 0, summaries: preview.summary as Array<{ codeIsr: string; status: string }> });
    }
    if (preview.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "La previsualisation a expire" }, { status: 409 });
    }
    if (preview.sourceHash !== expectedHash) {
      return NextResponse.json({ error: "La previsualisation n'est plus valide pour cette source" }, { status: 409 });
    }

    let applied = 0;
    const summaries: Array<{ codeIsr: string; status: string }> = [];

    await prisma.$transaction(async (tx) => {
      for (const listing of listings) {
        const metadata = inferGestionIsrMetadata(listing.descriptionFr);
        const statusInfo = normalizeGestionIsrUnitStatus(listing.sourceStatus || listing.statusLabel);
        const buildingCode = buildEntityCode("BLDG", listing.buildingId || listing.sourceId || listing.codeIsr);
        const unitCode = buildEntityCode("UNIT", listing.unitId || listing.codeIsr);

        const building = await tx.building.upsert({
          where: { codeIsr: buildingCode },
          update: { address: cleanText(listing.address), city: cleanText(listing.city), district: cleanText(listing.district) || null, description: cleanText(listing.descriptionFr).slice(0, 2000) || null, gestionIsrUrl: listing.listingUrl || sourceUrl },
          create: { codeIsr: buildingCode, address: cleanText(listing.address), city: cleanText(listing.city), district: cleanText(listing.district) || null, description: cleanText(listing.descriptionFr).slice(0, 2000) || null, gestionIsrUrl: listing.listingUrl || sourceUrl },
        });

        const rentalUnit = await tx.rentalUnit.upsert({
          where: { codeIsr: unitCode },
          update: {
            buildingId: building.id,
            monthlyPrice: listing.monthlyPrice,
            bedrooms: listing.bedrooms,
            propertyType: cleanText(listing.propertyType),
            description: cleanText(listing.descriptionFr).slice(0, 4000),
            status: statusInfo.normalizedStatus as PropertyStatus,
            petsAllowed: metadata.petsAllowed,
            parking: metadata.parking,
            inclusions: cleanText(metadata.inclusions) || null,
            availableFrom: listing.availableFrom ? new Date(listing.availableFrom) : null,
            gestionIsrUrl: listing.listingUrl || sourceUrl,
          },
          create: {
            codeIsr: unitCode,
            buildingId: building.id,
            monthlyPrice: listing.monthlyPrice,
            bedrooms: listing.bedrooms,
            propertyType: cleanText(listing.propertyType),
            description: cleanText(listing.descriptionFr).slice(0, 4000),
            status: statusInfo.normalizedStatus as PropertyStatus,
            petsAllowed: metadata.petsAllowed,
            parking: metadata.parking,
            inclusions: cleanText(metadata.inclusions) || null,
            availableFrom: listing.availableFrom ? new Date(listing.availableFrom) : null,
            gestionIsrUrl: listing.listingUrl || sourceUrl,
          },
        });

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
          create: {
            codeIsr: listing.codeIsr,
            address: cleanText(listing.address),
            city: cleanText(listing.city),
            district: cleanText(listing.district) || null,
            monthlyPrice: listing.monthlyPrice,
            propertyType: cleanText(listing.propertyType),
            bedrooms: listing.bedrooms,
            petsAllowed: metadata.petsAllowed,
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

        const photoUrls = dedupeUrls((listing.photoUrls || []).map((url: string) => cleanText(url)).filter(Boolean));
        if (photoUrls.length > 0) {
          const existingPhotos = await tx.buildingPhoto.findMany({ where: { buildingId: building.id } });
          for (const url of photoUrls) {
            const exists = existingPhotos.some((photo) => photo.url === url);
            if (!exists) {
              await tx.buildingPhoto.create({ data: { buildingId: building.id, url, sortOrder: existingPhotos.length } });
            }
          }

          const existingRentalPhotos = await tx.rentalUnitPhoto.findMany({ where: { rentalUnitId: rentalUnit.id } });
          for (const [index, url] of photoUrls.entries()) {
            const exists = existingRentalPhotos.some((photo) => photo.url === url);
            if (!exists) {
              await tx.rentalUnitPhoto.create({ data: { rentalUnitId: rentalUnit.id, url, sortOrder: index } });
            }
          }
        }

        if (!rentalUnit.primaryPhotoUrl) {
          await tx.rentalUnit.update({ where: { id: rentalUnit.id }, data: { primaryPhotoUrl: photoUrls[0] || null } });
        }

        if (property.rentalUnitId !== rentalUnit.id) {
          await tx.property.update({ where: { id: property.id }, data: { rentalUnitId: rentalUnit.id } });
        }

        applied += 1;
        summaries.push({ codeIsr: listing.codeIsr, status: statusInfo.normalizedStatus });
      }

      await tx.gestionIsrSyncPreview.update({
        where: { id: preview.id },
        data: { status: "APPLIED", appliedAt: new Date() },
      });
    });

    await writeAuditLog({
      userId: auth.user!.id,
      entity: "Property",
      entityId: `preview-${preview.id}`,
      action: "SYNC_GESTION_ISR_APPLY",
      metadata: { previewId: preview.id, sourceUrl, applied, summaries },
    });

    return NextResponse.json({ ok: true, previewId: preview.id, sourceUrl, applied, summaries });
  } catch {
    return safeServerError();
  }
}
