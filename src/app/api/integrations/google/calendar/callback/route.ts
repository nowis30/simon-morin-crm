import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForGoogleTokens,
  fetchGoogleAccountEmail,
  GOOGLE_CALENDAR_SCOPES,
  hasGoogleCalendarCredentials,
  upsertGoogleConnection,
} from "@/lib/google-calendar";
import { env, getGoogleCalendarConfigIssues } from "@/lib/env";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      console.warn("[google-calendar-callback] unauthenticated callback", { path: request.nextUrl.pathname });
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("reason", "google_calendar_session");
      return NextResponse.redirect(loginUrl);
    }

    console.log("[google-calendar-callback] processing callback", { userId: auth.user?.id, hasCode: Boolean(request.nextUrl.searchParams.get("code")) });

    if (!hasGoogleCalendarCredentials()) {
      const url = new URL("/settings/calendar", request.url);
      url.searchParams.set("error", "config");
      url.searchParams.set("details", getGoogleCalendarConfigIssues().join(", "));
      return NextResponse.redirect(url);
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const oauthError = request.nextUrl.searchParams.get("error");

    if (oauthError) {
      const url = new URL("/settings/calendar", request.url);
      url.searchParams.set("error", oauthError);
      return NextResponse.redirect(url);
    }

    if (!code || !state) {
      const url = new URL("/settings/calendar", request.url);
      url.searchParams.set("error", "missing_oauth_payload");
      return NextResponse.redirect(url);
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get("google_oauth_state")?.value;
    if (!expectedState || expectedState !== state || !state.startsWith(`${auth.user!.id}:`)) {
      const url = new URL("/settings/calendar", request.url);
      url.searchParams.set("error", "invalid_state");
      return NextResponse.redirect(url);
    }

    const tokenData = await exchangeCodeForGoogleTokens(code);
    const refreshToken = tokenData.refresh_token;

    if (!refreshToken) {
      const url = new URL("/settings/calendar", request.url);
      url.searchParams.set("error", "missing_refresh_token");
      return NextResponse.redirect(url);
    }

    const accountEmail = await fetchGoogleAccountEmail(tokenData.access_token);
    await upsertGoogleConnection({
      userId: auth.user!.id,
      accessToken: tokenData.access_token,
      refreshToken,
      expiresInSeconds: tokenData.expires_in,
      scopes: tokenData.scope ? tokenData.scope.split(" ") : GOOGLE_CALENDAR_SCOPES,
      googleAccountEmail: accountEmail,
    });

    const redirectUrl = new URL("/settings/calendar", request.url);
    redirectUrl.searchParams.set("success", "connected");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: "google_oauth_state",
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    const url = new URL("/settings/calendar", request.url);
    url.searchParams.set("error", "oauth_exchange_failed");
    if (message) {
      const safeDetails = message.replace(/(client_secret|access_token|refresh_token|token|code|secret)=([^&\s,;]+)/gi, "$1=[masqué]");
      url.searchParams.set("details", safeDetails);
    }
    return NextResponse.redirect(url);
  }
}
