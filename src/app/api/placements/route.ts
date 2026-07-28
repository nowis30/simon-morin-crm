import { NextRequest, NextResponse } from "next/server";
import { defaultCommissionAmount } from "@/lib/match-score";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { validateCsrfToken } from "@/lib/csrf";
import { placementCreateSchema } from "@/lib/validators";
import { cleanText } from "@/lib/sanitize";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const items = await prisma.placement.findMany({
      include: { prospect: true, property: true, commission: true, visit: true },
      orderBy: { createdAt: "desc" },
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
    const parsed = placementCreateSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const data = parsed.data;
    const placement = await prisma.placement.create({
      data: {
        prospectId: data.prospectId,
        propertyId: data.propertyId,
        visitId: data.visitId || null,
        visitDate: data.visitDate ? new Date(data.visitDate) : null,
        sentToColleaguesDate: data.sentToColleaguesDate ? new Date(data.sentToColleaguesDate) : null,
        acceptanceDate: data.acceptanceDate ? new Date(data.acceptanceDate) : null,
        signatureDate: data.signatureDate ? new Date(data.signatureDate) : null,
        moveInDate: data.moveInDate ? new Date(data.moveInDate) : null,
        notes: cleanText(data.notes),
        commission: {
          create: {
            plannedAmount: defaultCommissionAmount(),
            status: "PLANNED",
          },
        },
      },
      include: { commission: true, prospect: true, property: true },
    });

    await prisma.prospect.update({ where: { id: data.prospectId }, data: { status: "PLACED" } });
    await prisma.property.update({ where: { id: data.propertyId }, data: { status: "RENTED" } });

    return NextResponse.json({ item: placement }, { status: 201 });
  } catch {
    return safeServerError();
  }
}
