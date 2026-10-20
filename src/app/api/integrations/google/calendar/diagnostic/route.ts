import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getGoogleCalendarDiagnostic } from "@/lib/google-calendar";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const diagnostic = await getGoogleCalendarDiagnostic(auth.user!.id);
    const redirectUriConfigured = Boolean(env.GOOGLE_REDIRECT_URI);

    return NextResponse.json({
      authenticated: true,
      ...diagnostic,
      redirectUriConfigured,
      redirectUriHost: env.GOOGLE_REDIRECT_URI ? new URL(env.GOOGLE_REDIRECT_URI).host : null,
    });
  } catch {
    return safeServerError();
  }
}
