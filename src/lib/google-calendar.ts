import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/google-token-crypto";
import { appTimeZone, env, getGoogleCalendarConfigIssues, googleCalendarId } from "@/lib/env";

const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
];

export type BusyRange = { start: string; end: string };

export function hasGoogleCalendarCredentials() {
  return getGoogleCalendarConfigIssues().length === 0;
}

export function createOAuthState(userId: string) {
  const nonce = randomBytes(12).toString("hex");
  return `${userId}:${nonce}`;
}

export function createGoogleCalendarAuthUrl(state: string) {
  if (!hasGoogleCalendarCredentials()) {
    throw new Error("Configuration Google Agenda incomplete");
  }

  const callbackUrl = env.GOOGLE_REDIRECT_URI!;

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    state,
  });

  return `${GOOGLE_OAUTH_BASE}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export function sanitizeGoogleOAuthDetails(details?: string | null) {
  if (!details) return null;

  const sanitized = details
    .replace(/(client_secret|access_token|refresh_token|token|code|secret)=([^&\s,;]+)/gi, "$1=[masqué]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [masqué]");

  return sanitized.trim() || null;
}

async function exchangeToken(payload: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload),
  });

  const data = (await response.json()) as TokenResponse & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    const details = sanitizeGoogleOAuthDetails(data.error_description || data.error || "Erreur inconnue");
    throw new Error(`Echec OAuth Google${details ? `: ${details}` : ""}`);
  }
  return data;
}

export async function exchangeCodeForGoogleTokens(code: string) {
  return exchangeToken({
    code,
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: env.GOOGLE_REDIRECT_URI!,
    grant_type: "authorization_code",
  });
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  return exchangeToken({
    refresh_token: refreshToken,
    client_id: env.GOOGLE_CLIENT_ID!,
    client_secret: env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });
}

export async function fetchGoogleAccountEmail(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { email?: string };
  return data.email ?? null;
}

export async function upsertGoogleConnection(params: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scopes: string[];
  googleAccountEmail: string | null;
}) {
  const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000);
  const encryptedAccessToken = encryptToken(params.accessToken);
  const encryptedRefreshToken = encryptToken(params.refreshToken);

  return prisma.googleCalendarConnection.upsert({
    where: { userId: params.userId },
    update: {
      googleAccountEmail: params.googleAccountEmail,
      calendarId: googleCalendarId,
      accessTokenEncrypted: encryptedAccessToken,
      refreshTokenEncrypted: encryptedRefreshToken,
      accessTokenExpiresAt: expiresAt,
      scopes: params.scopes,
      connectedAt: new Date(),
    },
    create: {
      userId: params.userId,
      googleAccountEmail: params.googleAccountEmail,
      calendarId: googleCalendarId,
      accessTokenEncrypted: encryptedAccessToken,
      refreshTokenEncrypted: encryptedRefreshToken,
      accessTokenExpiresAt: expiresAt,
      scopes: params.scopes,
      connectedAt: new Date(),
    },
  });
}

export async function getGoogleConnectionStatus(userId: string) {
  const issues = getGoogleCalendarConfigIssues();
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { userId } });

  if (issues.length > 0) {
    return {
      configured: false,
      configIssues: issues,
      connected: false,
      googleAccountEmail: null,
      calendarId: googleCalendarId,
      lastSyncAt: null,
      needsReconnect: false,
      timeZone: appTimeZone,
    };
  }

  if (!connection) {
    return {
      configured: true,
      configIssues: [],
      connected: false,
      googleAccountEmail: null,
      calendarId: googleCalendarId,
      lastSyncAt: null,
      needsReconnect: false,
      timeZone: appTimeZone,
    };
  }

  const needsReconnect = connection.accessTokenExpiresAt.getTime() < Date.now() && !connection.refreshTokenEncrypted;

  return {
    configured: true,
    configIssues: [],
    connected: true,
    googleAccountEmail: connection.googleAccountEmail,
    calendarId: connection.calendarId,
    lastSyncAt: connection.lastSyncAt,
    needsReconnect,
    timeZone: appTimeZone,
  };
}

export async function disconnectGoogleCalendar(userId: string) {
  await prisma.googleCalendarConnection.deleteMany({ where: { userId } });
}

export async function getGoogleCalendarDiagnostic(userId: string) {
  const status = await getGoogleConnectionStatus(userId);
  const result = {
    ...status,
    apiVerified: false,
    calendarAccessRole: null as string | null,
    checkedAt: new Date().toISOString(),
    issues: [...status.configIssues],
  };
  if (!status.configured || !status.connected) return result;

  try {
    const credentials = await getValidGoogleAccessToken(userId);
    if (!credentials.token) {
      result.needsReconnect = true;
      result.issues.push("Reconnexion Google requise pour verifier le calendrier.");
      return result;
    }

    // Read only calendar metadata, never event titles, attendees, or descriptions.
    const response = await fetch(
      `${GOOGLE_CALENDAR_BASE}/users/me/calendarList/${encodeURIComponent(status.calendarId)}?fields=id,accessRole`,
      {
        headers: { Authorization: `Bearer ${credentials.token}` },
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      result.needsReconnect = response.status === 401;
      result.issues.push(
        response.status === 401 ? "Reconnexion Google requise."
          : response.status === 403 ? "Acces Google Agenda refuse. Verifiez les autorisations."
            : response.status === 404 ? "Le calendrier configure est introuvable ou inaccessible."
              : "La verification Google Agenda est temporairement indisponible.",
      );
      return result;
    }
    const calendar = await response.json() as { id?: string; accessRole?: string };
    if (!calendar.id || !["owner", "writer", "reader", "freeBusyReader"].includes(calendar.accessRole ?? "")) {
      result.issues.push("Google a retourne une reponse de calendrier incomplete.");
      return result;
    }
    result.apiVerified = true;
    result.calendarAccessRole = calendar.accessRole!;
    if (!["owner", "writer"].includes(calendar.accessRole!)) {
      result.issues.push("Ce compte ne peut pas modifier ce calendrier.");
    }
    return result;
  } catch {
    result.issues.push("La verification Google Agenda a echoue. Reessayez ou reconnectez le compte.");
    return result;
  }
}

export async function getValidGoogleAccessToken(userId: string) {
  const connection = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!connection) {
    return { token: null, reason: "NOT_CONNECTED" as const };
  }

  if (connection.accessTokenExpiresAt.getTime() > Date.now() + 30_000) {
    return { token: decryptToken(connection.accessTokenEncrypted), reason: "OK" as const };
  }

  try {
    const refreshed = await refreshGoogleAccessToken(decryptToken(connection.refreshTokenEncrypted));
    const accessTokenEncrypted = encryptToken(refreshed.access_token);
    const accessTokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    await prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenEncrypted,
        accessTokenExpiresAt,
        scopes: refreshed.scope ? refreshed.scope.split(" ") : connection.scopes,
        lastSyncAt: new Date(),
      },
    });

    return { token: refreshed.access_token, reason: "REFRESHED" as const };
  } catch {
    return { token: null, reason: "RECONNECT_REQUIRED" as const };
  }
}

async function googleCalendarRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GOOGLE_CALENDAR_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error("Echec Google Calendar API");
  }

  return (await response.json()) as T;
}

export async function fetchGoogleBusyRanges(params: {
  userId: string;
  timeMin: string;
  timeMax: string;
  calendarId?: string;
}) {
  const tokenResult = await getValidGoogleAccessToken(params.userId);
  if (!tokenResult.token) {
    if (tokenResult.reason === "RECONNECT_REQUIRED") {
      throw new Error("Reconnexion Google requise pour verifier les disponibilites");
    }
    return { source: "NO_GOOGLE" as const, ranges: [] as BusyRange[] };
  }

  type FreeBusyResponse = {
    calendars?: Record<string, { busy?: BusyRange[]; errors?: Array<{ reason?: string }> }>;
  };

  const body = {
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    timeZone: appTimeZone,
    items: [{ id: params.calendarId || googleCalendarId }],
  };

  const data = await googleCalendarRequest<FreeBusyResponse>(tokenResult.token, "/freeBusy", {
    method: "POST",
    body: JSON.stringify(body),
  });

  // Google can return HTTP 200 with a per-calendar permission/not-found error.
  // Never interpret that response as an empty (fully available) calendar.
  const calendar = data.calendars?.[body.items[0].id];
  if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) {
    throw new Error("Impossible de verifier les disponibilites du calendrier Google");
  }
  const calendarBusy = calendar.busy;

  await prisma.googleCalendarConnection.updateMany({
    where: { userId: params.userId },
    data: { lastSyncAt: new Date() },
  });

  return {
    source: "GOOGLE" as const,
    ranges: calendarBusy.map((item) => ({ start: item.start, end: item.end })),
  };
}

export async function createGoogleCalendarEvent(params: {
  userId: string;
  summary: string;
  description: string;
  location: string;
  startsAtIso: string;
  endsAtIso: string;
  calendarId?: string;
}) {
  const tokenResult = await getValidGoogleAccessToken(params.userId);
  if (!tokenResult.token) {
    throw new Error("Reconnexion Google requise");
  }

  type CreateEventResponse = { id: string; htmlLink?: string };
  const data = await googleCalendarRequest<CreateEventResponse>(
    tokenResult.token,
    `/calendars/${encodeURIComponent(params.calendarId || googleCalendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: { dateTime: params.startsAtIso, timeZone: appTimeZone },
        end: { dateTime: params.endsAtIso, timeZone: appTimeZone },
      }),
    },
  );

  return { eventId: data.id, eventLink: data.htmlLink ?? null };
}

export async function updateGoogleCalendarEvent(params: {
  userId: string;
  eventId: string;
  summary: string;
  description: string;
  location: string;
  startsAtIso: string;
  endsAtIso: string;
  calendarId?: string;
}) {
  const tokenResult = await getValidGoogleAccessToken(params.userId);
  if (!tokenResult.token) {
    throw new Error("Reconnexion Google requise");
  }

  await googleCalendarRequest(
    tokenResult.token,
    `/calendars/${encodeURIComponent(params.calendarId || googleCalendarId)}/events/${encodeURIComponent(params.eventId)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: { dateTime: params.startsAtIso, timeZone: appTimeZone },
        end: { dateTime: params.endsAtIso, timeZone: appTimeZone },
      }),
    },
  );
}

export async function deleteGoogleCalendarEvent(params: {
  userId: string;
  eventId: string;
  calendarId?: string;
}) {
  const tokenResult = await getValidGoogleAccessToken(params.userId);
  if (!tokenResult.token) {
    throw new Error("Reconnexion Google requise");
  }

  const response = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(params.calendarId || googleCalendarId)}/events/${encodeURIComponent(params.eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenResult.token}` },
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error("Echec suppression evenement Google");
  }
}
