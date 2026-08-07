import { NextResponse } from "next/server";
import { env, getGoogleCalendarConfigIssues, googleCalendarId } from "@/lib/env";
import { getGoogleConnectionStatus, hasGoogleCalendarCredentials } from "@/lib/google-calendar";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const status = await getGoogleConnectionStatus(auth.user!.id);
    const configured = hasGoogleCalendarCredentials();
    const redirectUriConfigured = Boolean(env.GOOGLE_REDIRECT_URI);

    return NextResponse.json({
      authenticated: true,
      configured,
      redirectUriConfigured,
      redirectUriHost: env.GOOGLE_REDIRECT_URI ? new URL(env.GOOGLE_REDIRECT_URI).host : null,
      calendarId: googleCalendarId,
      connected: status.connected,
      googleAccountEmail: status.googleAccountEmail,
      configIssues: configured ? [] : getGoogleCalendarConfigIssues(),
    });
  } catch {
    return safeServerError();
  }
}
