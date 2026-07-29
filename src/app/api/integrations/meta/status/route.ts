import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getMetaStatus } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const status = await getMetaStatus(auth.user!.id);
    return NextResponse.json({
      ...status,
      appIdConfigured: Boolean(env.META_APP_ID),
      appSecretConfigured: Boolean(env.META_APP_SECRET),
      redirectUri: env.META_REDIRECT_URI || null,
      permissions: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
      missingPermissions: [],
      dryRun: process.env.META_DRY_RUN === "true",
      error: null,
    });
  } catch {
    return safeServerError();
  }
}
