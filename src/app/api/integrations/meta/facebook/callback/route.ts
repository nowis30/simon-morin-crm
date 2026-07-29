import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { completeMetaOAuthConnection } from "@/lib/meta-facebook";
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

    if (!expectedState || !state || expectedState !== state) {
      return NextResponse.redirect(new URL("/marketing/approval?meta=state_error", request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/marketing/approval?meta=missing_code", request.url));
    }

    await completeMetaOAuthConnection(auth.user!.id, code);
    return NextResponse.redirect(new URL("/marketing/approval?meta=connected", request.url));
  } catch {
    return safeServerError();
  }
}
