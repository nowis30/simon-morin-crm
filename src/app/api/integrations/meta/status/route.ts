import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getMetaDiagnostic } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const status = await getMetaDiagnostic(auth.user!.id);
    return NextResponse.json({
      ...status,
      appIdConfigured: Boolean(env.META_APP_ID),
      appSecretConfigured: Boolean(env.META_APP_SECRET),
      redirectUri: env.META_REDIRECT_URI || null,
      permissions: status.grantedScopes,
      missingPermissions: status.missingScopes,
      dryRun: process.env.META_DRY_RUN === "true",
      error: status.issues[0] ?? null,
    });
  } catch {
    return safeServerError();
  }
}
