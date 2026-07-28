import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, hasAnyAdmin, setSessionCookie, verifyPassword } from "@/lib/auth";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/route-guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const adminExists = await hasAnyAdmin();
    if (!adminExists) {
      return NextResponse.json({ error: "Configuration initiale requise" }, { status: 409 });
    }

    const rate = checkRateLimit(getClientIp(request));
    if (!rate.allowed) {
      return NextResponse.json({ error: "Trop de tentatives, reessayez plus tard" }, { status: 429 });
    }

    const payload = await request.json();
    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    const validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!validPassword) {
      return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
    }

    const token = await createSessionToken({ userId: user.id, email: user.email });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur de connexion" }, { status: 500 });
  }
}
