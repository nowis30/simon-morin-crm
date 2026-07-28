import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { prospectCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const items = await prisma.prospect.findMany({
      include: { firstContactProperty: true, interactions: { orderBy: { at: "desc" }, take: 5 } },
      orderBy: [{ createdAt: "desc" }],
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

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const payload = await request.json();
    const parsed = prospectCreateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const data = parsed.data;
    const prospect = await prisma.prospect.create({
      data: {
        name: cleanText(data.name),
        phone: cleanText(data.phone),
        email: cleanText(data.email) || null,
        messengerUrl: data.messengerUrl || null,
        preferredLanguage: data.preferredLanguage,
        maxBudget: data.maxBudget,
        preferredDistricts: data.preferredDistricts.map((district) => cleanText(district)),
        bedroomsNeeded: data.bedroomsNeeded,
        moveInDate: data.moveInDate ? new Date(data.moveInDate) : null,
        hasPets: data.hasPets,
        needsParking: data.needsParking,
        jobTitle: cleanText(data.jobTitle),
        firstContactPropertyId: data.firstContactPropertyId || null,
        nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt) : null,
        notes: cleanText(data.notes),
        status: data.status,
        lastContactAt: new Date(),
      },
    });

    await writeAuditLog({ userId: auth.user!.id, entity: "Prospect", entityId: prospect.id, action: "CREATE" });
    return NextResponse.json({ item: prospect }, { status: 201 });
  } catch {
    return safeServerError();
  }
}
