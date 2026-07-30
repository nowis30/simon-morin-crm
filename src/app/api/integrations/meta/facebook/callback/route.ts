import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { completeMetaOAuthConnection, isMetaStateValid } from "@/lib/meta-facebook";
import { getPublicAppUrl } from "@/lib/public-url";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const expectedState = (await cookies()).get("meta_oauth_state")?.value;
    const state = request.nextUrl.searchParams.get("state");
    const code = request.nextUrl.searchParams.get("code");
    const oauthError = request.nextUrl.searchParams.get("error");

    if (oauthError) {
      const reason = oauthError === "access_denied" ? "access_denied" : "oauth_refused";
      const response = NextResponse.redirect(new URL(`/marketing/approval?meta=${reason}`, getPublicAppUrl()));
      response.cookies.delete("meta_oauth_state");
      return response;
    }

    if (!expectedState || !state || !isMetaStateValid({ state, expectedState, userId: auth.user!.id })) {
      const response = NextResponse.redirect(new URL("/marketing/approval?meta=state_error", getPublicAppUrl()));
      response.cookies.delete("meta_oauth_state");
      return response;
    }

    if (!code) {
      const response = NextResponse.redirect(new URL("/marketing/approval?meta=missing_code", getPublicAppUrl()));
      response.cookies.delete("meta_oauth_state");
      return response;
    }

    await completeMetaOAuthConnection(auth.user!.id, code);
    const response = NextResponse.redirect(new URL("/marketing/approval?meta=connected", getPublicAppUrl()));
    response.cookies.delete("meta_oauth_state");
    return response;
  } catch {
    return safeServerError();
  }
}
