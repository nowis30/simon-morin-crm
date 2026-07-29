import { NextResponse } from "next/server";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { fetchGestionIsrListings, inferGestionIsrMetadata, normalizeGestionIsrUnitStatus } from "@/integrations/gestion-isr/importer";
import { cleanText } from "@/lib/sanitize";
import { createHash } from "node:crypto";

const DEFAULT_GESTION_ISR_URL = "https://location.gestion-isr.com/";

function buildPreviewId(payload: unknown) {
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
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
    const previewId = buildPreviewId({ sourceUrl, listings: listings.slice(0, 10) });

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

    return NextResponse.json({ ok: true, previewId, sourceUrl, generatedAt: new Date().toISOString(), summary });
  } catch {
    return safeServerError();
  }
}
