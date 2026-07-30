import { NextResponse } from "next/server";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { prisma } from "@/lib/prisma";
import { fetchGestionIsrListings, inferGestionIsrMetadata, normalizeGestionIsrUnitStatus } from "@/integrations/gestion-isr/importer";
import { cleanText } from "@/lib/sanitize";
import { createHash } from "node:crypto";

const DEFAULT_GESTION_ISR_URL = "https://location.gestion-isr.com/";
const PREVIEW_TTL_MINUTES = 30;

function buildPreviewHash(sourceUrl: string, listings: unknown[]) {
  const normalized = listings
    .map((listing) => ({
      ...(listing as Record<string, unknown>),
      photoUrls: (listing as Record<string, unknown>).photoUrls,
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash("sha1").update(JSON.stringify({ sourceUrl, listings: normalized })).digest("hex");
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const payload = (await request.json().catch(() => ({}))) as { url?: string };
    const sourceUrl = payload.url?.trim() || process.env.GESTION_ISR_LISTINGS_URL || DEFAULT_GESTION_ISR_URL;

    const listings = await fetchGestionIsrListings(sourceUrl);
    const sourceHash = buildPreviewHash(sourceUrl, listings);

    const summary = listings.map((listing) => {
      const metadata = inferGestionIsrMetadata(listing.descriptionFr);
      const statusInfo = normalizeGestionIsrUnitStatus(listing.sourceStatus || listing.statusLabel);
      return {
        codeIsr: listing.codeIsr,
        address: cleanText(listing.address),
        city: cleanText(listing.city),
        price: listing.monthlyPrice,
        status: statusInfo.normalizedStatus,
        isPublishable: statusInfo.isPublishable,
        photos: listing.photoUrls.length,
        petsAllowed: metadata.petsAllowed,
        parking: metadata.parking,
      };
    });

    const preview = await prisma.gestionIsrSyncPreview.create({
      data: {
        userId: auth.user!.id,
        sourceUrl,
        sourceHash,
        sourceCount: listings.length,
        summary,
        snapshot: { sourceUrl, listings: listings.map((listing) => ({
          codeIsr: listing.codeIsr,
          address: cleanText(listing.address),
          city: cleanText(listing.city),
          monthlyPrice: listing.monthlyPrice,
          bedrooms: listing.bedrooms,
          propertyType: cleanText(listing.propertyType),
          descriptionFr: cleanText(listing.descriptionFr),
          sourceStatus: listing.sourceStatus || listing.statusLabel,
          photoUrls: listing.photoUrls,
        })) },
        expiresAt: new Date(Date.now() + PREVIEW_TTL_MINUTES * 60 * 1000),
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ ok: true, previewId: preview.id, sourceUrl, generatedAt: new Date().toISOString(), summary, expiresAt: preview.expiresAt.toISOString() });
  } catch {
    return safeServerError();
  }
}
