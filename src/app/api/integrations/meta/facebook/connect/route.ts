import { NextResponse } from "next/server";
import { env, getMetaConfigIssues } from "@/lib/env";
import { connectMetaFromEnvToken, createMetaOAuthUrl, createMetaState } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    if (env.META_PAGE_ACCESS_TOKEN) {
      await connectMetaFromEnvToken(auth.user!.id);
      return NextResponse.redirect(new URL("/marketing/approval", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
    }

    if (!env.META_APP_ID || !env.META_REDIRECT_URI || !env.META_APP_SECRET) {
      return NextResponse.json({ error: "Configuration Meta incomplete", details: getMetaConfigIssues() }, { status: 400 });
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
