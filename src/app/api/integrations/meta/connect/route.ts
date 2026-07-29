import { NextRequest, NextResponse } from "next/server";
import { env, getMetaConfigIssues } from "@/lib/env";
import { connectMetaFromEnvToken, createMetaOAuthUrl, createMetaState } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const configIssues = getMetaConfigIssues();
    if (configIssues.length > 0) {
      return NextResponse.json({ error: "Connexion a la Page Facebook non configuree" }, { status: 400 });
    }

    if (env.META_PAGE_ACCESS_TOKEN) {
      await connectMetaFromEnvToken(auth.user!.id);
      return NextResponse.redirect(new URL("/marketing/approval?meta=connected", request.url));
    }

    const state = createMetaState(auth.user!.id);
    const url = createMetaOAuthUrl(state);
    return NextResponse.redirect(url);
  } catch {
    return safeServerError();
  }
}
