import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { facebookGroupSchema } from "@/lib/validators";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const items = await prisma.facebookGroup.findMany({
      orderBy: [{ active: "desc" }, { city: "asc" }, { name: "asc" }],
      include: {
        publications: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { advertisement: true },
        },
      },
    });

    return NextResponse.json({ items });
  } catch {
    return safeServerError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = facebookGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const item = await prisma.facebookGroup.create({
      data: {
        name: cleanText(parsed.data.name),
        link: parsed.data.link,
        city: cleanText(parsed.data.city) || null,
        sectors: parsed.data.sectors.map(cleanText).filter(Boolean),
        language: cleanText(parsed.data.language) || null,
        active: parsed.data.active,
        isMember: parsed.data.isMember,
        isAdminOrModerator: parsed.data.isAdminOrModerator,
        rules: cleanText(parsed.data.rules) || null,
        notes: cleanText(parsed.data.notes) || null,
        minDelayHours: parsed.data.minDelayHours,
      },
    });

    return NextResponse.json({ item });
  } catch {
    return safeServerError();
  }
}
