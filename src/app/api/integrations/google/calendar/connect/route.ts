import { NextRequest, NextResponse } from "next/server";
import { createGoogleCalendarAuthUrl, createOAuthState, hasGoogleCalendarCredentials } from "@/lib/google-calendar";
import { getGoogleCalendarConfigIssues } from "@/lib/env";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      console.warn("[google-calendar-connect] unauthenticated request", { path: "/api/integrations/google/calendar/connect" });
      return auth.response;
    }

    console.log("[google-calendar-connect] starting OAuth flow", { userId: auth.user?.id });

    if (!hasGoogleCalendarCredentials()) {
      return NextResponse.json({ error: "Configuration Google Agenda incomplete", details: getGoogleCalendarConfigIssues() }, { status: 400 });
    }

    const state = createOAuthState(auth.user!.id);
    const url = createGoogleCalendarAuthUrl(state);
    const response = NextResponse.redirect(url);
    response.cookies.set({
      name: "google_oauth_state",
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
