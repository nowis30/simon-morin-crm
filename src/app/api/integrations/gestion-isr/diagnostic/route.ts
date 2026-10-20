import { NextResponse } from "next/server";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { buildGestionIsrDiagnostic } from "@/integrations/gestion-isr/diagnostic";
import { fetchGestionIsrRawRecords } from "@/integrations/gestion-isr/importer";

// Hôtes légitimes connus pour l'import Gestion ISR (voir importer.ts).
// L'hôte configuré via GESTION_ISR_LISTINGS_URL est aussi accepté (choix de l'admin).
const ISR_ALLOWED_HOSTS = ["location.gestion-isr.com"];

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost") return true;
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return true;
  // Littéral IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  // Littéral IPv6
  if (host.includes(":")) return true;
  return false;
}

function isAllowedIsrUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") {
    return false;
  }
  if (isPrivateHost(parsed.hostname)) {
    return false;
  }
  const allowed = new Set(ISR_ALLOWED_HOSTS.map((h) => h.toLowerCase()));
  const configured = process.env.GESTION_ISR_LISTINGS_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).hostname.toLowerCase());
    } catch {
      // URL configurée invalide : on l'ignore, la liste de base s'applique.
    }
  }
  return allowed.has(parsed.hostname.toLowerCase());
}

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
