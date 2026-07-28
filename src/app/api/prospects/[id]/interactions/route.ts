import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { interactionSchema } from "@/lib/validators";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    const payload = await request.json();

    const parsed = interactionSchema.safeParse({ ...payload, prospectId: id });
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const interaction = await prisma.prospectInteraction.create({
      data: {
        prospectId: id,
        type: parsed.data.type,
        summary: cleanText(parsed.data.summary),
        userId: auth.user!.id,
      },
    });

    await prisma.prospect.update({ where: { id }, data: { lastContactAt: new Date() } });

    return NextResponse.json({ item: interaction }, { status: 201 });
  } catch {
    return safeServerError();
  }
}
