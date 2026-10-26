import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, hasAnyAdmin, hashPassword, setSessionCookie } from "@/lib/auth";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/sanitize";
import { setupSchema } from "@/lib/validators";
import { checkSetupToken } from "@/lib/setup-token";

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

    const setupAccess = checkSetupToken(request.headers.get("x-setup-token"));
    if (setupAccess === "unconfigured") {
      return NextResponse.json({ error: "Initialisation indisponible. Contactez le responsable de l'application." }, { status: 503 });
    }
    if (setupAccess !== "valid") {
      return NextResponse.json({ error: "Code d'initialisation invalide" }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const parsed = setupSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await prisma.$transaction(async (tx) => {
      // Serialize the empty-database check so concurrent requests cannot create extra admins.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(48293141)`;
      if (await tx.user.count()) return null;
      return tx.user.create({
        data: {
          name: cleanText(parsed.data.name),
          email: cleanText(parsed.data.email).toLowerCase(),
          passwordHash,
        },
      });
    });
    if (!user) {
      return NextResponse.json({ error: "Configuration deja effectuee" }, { status: 409 });
    }

    const token = await createSessionToken({ userId: user.id, email: user.email, tokenVersion: user.tokenVersion });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Impossible de terminer la configuration" }, { status: 500 });
  }
}
