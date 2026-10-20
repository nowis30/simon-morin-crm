import { NextResponse } from "next/server";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { buildGestionIsrDiagnostic } from "@/integrations/gestion-isr/diagnostic";
import { fetchGestionIsrRawRecords } from "@/integrations/gestion-isr/importer";
import { isAllowedIsrUrl } from "@/integrations/gestion-isr/source-policy";

export async function GET(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const sourceUrl = url.searchParams.get("url") || process.env.GESTION_ISR_LISTINGS_URL || "https://location.gestion-isr.com/";

    if (!isAllowedIsrUrl(sourceUrl)) {
      return NextResponse.json({ error: "Hôte non autorisé pour le diagnostic ISR" }, { status: 400 });
    }

    const record = await fetchGestionIsrRawRecords(sourceUrl);

    if (!record) {
      return NextResponse.json({ error: "Aucun enregistrement brut disponible" }, { status: 404 });
    }

    return NextResponse.json({
      diagnostic: buildGestionIsrDiagnostic(record),
      note: "Cet aperçu ne contient pas de secrets Supabase et ne conserve que des identifiants de structure.",
    });
  } catch {
    return safeServerError();
  }
}
