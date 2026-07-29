import { NextResponse } from "next/server";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    return NextResponse.json({ items: [], message: "Sélection de page à compléter après connexion OAuth" });
  } catch {
    return safeServerError();
  }
}
