import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, hasAnyAdmin, hashPassword, setSessionCookie } from "@/lib/auth";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/sanitize";
import { setupSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const alreadyConfigured = await hasAnyAdmin();
    if (alreadyConfigured) {
      return NextResponse.json({ error: "Configuration deja effectuee" }, { status: 409 });
    }

    const payload = await request.json();
    const parsed = setupSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.user.create({
      data: {
        name: cleanText(parsed.data.name),
        email: cleanText(parsed.data.email).toLowerCase(),
        passwordHash,
      },
    });

    const token = await createSessionToken({ userId: user.id, email: user.email });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible de terminer la configuration" }, { status: 500 });
  }
}
