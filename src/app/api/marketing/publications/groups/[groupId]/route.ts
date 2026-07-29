import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { facebookGroupSchema } from "@/lib/validators";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { groupId } = await params;
    const body = await request.json();
    const parsed = facebookGroupSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const data = parsed.data;
    const item = await prisma.facebookGroup.update({
      where: { id: groupId },
      data: {
        name: data.name ? cleanText(data.name) : undefined,
        link: data.link,
        city: data.city !== undefined ? cleanText(data.city) || null : undefined,
        sectors: data.sectors ? data.sectors.map(cleanText).filter(Boolean) : undefined,
        language: data.language !== undefined ? cleanText(data.language) || null : undefined,
        active: data.active,
        isMember: data.isMember,
        isAdminOrModerator: data.isAdminOrModerator,
        rules: data.rules !== undefined ? cleanText(data.rules) || null : undefined,
        notes: data.notes !== undefined ? cleanText(data.notes) || null : undefined,
        minDelayHours: data.minDelayHours,
      },
    });

    return NextResponse.json({ item });
  } catch {
    return safeServerError();
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { groupId } = await params;
    await prisma.facebookGroup.delete({ where: { id: groupId } });
    return NextResponse.json({ ok: true });
  } catch {
    return safeServerError();
  }
}
