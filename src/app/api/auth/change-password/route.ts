import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateCsrfRequest } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { clearSessionCookie, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }
    if (!(await validateCsrfRequest(request))) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }
    if (!checkRateLimit(`password-change:${auth.user.id}`, 5).allowed) {
      return NextResponse.json({ error: "Trop de tentatives, reessayez plus tard" }, { status: 429 });
    }

    const parsed = changePasswordSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: auth.user.id } });
    if (!dbUser) {
      return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
    }

    const valid = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Mot de passe actuel invalide" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        passwordHash: await hashPassword(parsed.data.newPassword),
        // Invalide toutes les sessions existantes (y compris celle-ci).
        tokenVersion: { increment: 1 },
      },
    });

    await clearSessionCookie();

    return NextResponse.json({ ok: true });
  } catch {
    return safeServerError();
  }
}
