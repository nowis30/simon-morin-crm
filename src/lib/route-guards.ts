import { NextRequest, NextResponse } from "next/server";
import { isIP } from "node:net";
import { getCurrentUser } from "@/lib/auth";

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentification requise" }, { status: 401 }),
    };
  }
  return { user, response: null };
}

export function safeServerError() {
  return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
}

export function getClientIp(request: NextRequest) {
  // Render's edge overwrites this header. Do not trust a caller's X-Forwarded-For.
  if (process.env.RENDER === "true") {
    const ip = request.headers.get("cf-connecting-ip")?.trim();
    return ip && isIP(ip) ? ip : "unknown";
  }
  const ip = (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
  return isIP(ip) ? ip : "unknown";
}
