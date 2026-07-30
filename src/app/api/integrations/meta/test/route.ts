import { NextResponse } from "next/server";
import { getMetaDiagnostic } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function POST() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const diagnostic = await getMetaDiagnostic(auth.user!.id);
    return NextResponse.json({
      message: "Connexion Facebook testee.",
      pageId: diagnostic.pageId,
      pageName: diagnostic.pageName,
      grantedScopes: diagnostic.grantedScopes,
      missingScopes: diagnostic.missingScopes,
      tokenValid: diagnostic.tokenValid,
      graphApiVersion: diagnostic.graphApiVersion,
    });
  } catch {
    return safeServerError();
  }
}
