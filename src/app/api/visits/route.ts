import { VisitStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { visitCreateSchema } from "@/lib/validators";
import { assertVisitSlotStillAvailable, buildPendingVisitInput, isVisitRequestDuplicate } from "@/lib/visits";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const items = await prisma.visit.findMany({
      include: { prospect: true, property: true },
      orderBy: { startsAt: "asc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Doublon detecte: demande deja existante." }, { status: 409 });
    }
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
    const parsed = visitCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const startsAt = new Date(parsed.data.startsAt);
    const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : new Date(startsAt.getTime() + 30 * 60 * 1000);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return NextResponse.json({ error: "Horaire invalide" }, { status: 400 });
    }

    const slotCheck = await assertVisitSlotStillAvailable({
      userId: auth.user!.id,
      startsAtIso: startsAt.toISOString(),
      endsAtIso: endsAt.toISOString(),
    });

    if (!slotCheck.ok) {
      return NextResponse.json({ error: "Cette plage n'est plus disponible." }, { status: 409 });
    }

    const existingAtSameTime = await prisma.visit.findMany({
      where: {
        status: { in: [VisitStatus.PENDING_APPROVAL, VisitStatus.CONFIRMED] },
        startsAt,
      },
      select: { prospectId: true, propertyId: true, startsAt: true },
    });

    if (
      isVisitRequestDuplicate(existingAtSameTime, {
        prospectId: parsed.data.prospectId,
        propertyId: parsed.data.propertyId,
        startsAtIso: startsAt.toISOString(),
      })
    ) {
      return NextResponse.json({ error: "Demande deja existante pour ce prospect, logement et horaire." }, { status: 409 });
    }

    const createdInput = buildPendingVisitInput({
      prospectId: parsed.data.prospectId,
      propertyId: parsed.data.propertyId,
      startsAtIso: startsAt.toISOString(),
      endsAtIso: endsAt.toISOString(),
      notes: parsed.data.notes,
      idempotencyKey: parsed.data.idempotencyKey,
      minimumLeadHours: 2,
    });

    if (createdInput.idempotencyKey) {
      const existingByIdempotency = await prisma.visit.findUnique({ where: { idempotencyKey: createdInput.idempotencyKey } });
      if (existingByIdempotency) {
        const item = await prisma.visit.findUnique({
          where: { id: existingByIdempotency.id },
          include: { prospect: true, property: true },
        });
        return NextResponse.json({ item }, { status: 200 });
      }
    }

    const visit = await prisma.$transaction(async (tx) => {
      const created = await tx.visit.create({
        data: createdInput,
        include: { prospect: true, property: true },
      });

      await tx.property.update({
        where: { id: parsed.data.propertyId },
        data: { status: "VISIT_SCHEDULED" },
      });

      await tx.prospect.update({
        where: { id: parsed.data.prospectId },
        data: { status: "VISIT_REQUESTED" },
      });

      return created;
    });

    await writeAuditLog({ userId: auth.user!.id, entity: "Visit", entityId: visit.id, action: "REQUEST" });

    return NextResponse.json({ item: visit }, { status: 201 });
  } catch {
    return safeServerError();
  }
}
