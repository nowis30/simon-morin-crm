import { NextRequest, NextResponse } from "next/server";
import { env, getMetaConfigIssues } from "@/lib/env";
import { connectMetaFromEnvToken, createMetaOAuthUrl, createMetaState } from "@/lib/meta-facebook";
import { getPublicAppUrl } from "@/lib/public-url";
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
      return NextResponse.redirect(new URL("/marketing/approval?meta=connected", getPublicAppUrl()));
    }

    const state = createMetaState(auth.user!.id);
    const url = createMetaOAuthUrl(state);
    const response = NextResponse.redirect(url);
    response.cookies.set({
      name: "meta_oauth_state",
      value: state,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    return safeServerError();
  }
}
