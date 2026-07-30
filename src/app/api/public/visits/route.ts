import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { cleanText } from "@/lib/sanitize";
import { publicVisitSubmissionSchema } from "@/lib/validators";

function normalizePhone(phone: string) {
  return cleanText(phone).replace(/\D/g, "");
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parsed = publicVisitSubmissionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  const { prospect, visit } = parsed.data;
  const property = await prisma.property.findUnique({ where: { id: visit.propertyId } });
  if (!property) {
    return NextResponse.json({ error: "Cette propriété n’est plus disponible pour la visite." }, { status: 404 });
  }

  const normalizedPhone = normalizePhone(prospect.phone);
  const normalizedEmail = cleanText(prospect.email).toLowerCase();
  const existingProspect = await prisma.prospect.findFirst({
    where: {
      OR: [
        { phone: normalizedPhone },
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ],
    },
  });

  const mergedNotes = [
    prospect.occupantsCount ? `Occupants: ${prospect.occupantsCount}` : null,
    prospect.maxBudget ? `Budget maximal: ${prospect.maxBudget}$` : null,
    prospect.bedroomsNeeded !== undefined ? `Chambres recherchees: ${prospect.bedroomsNeeded}` : null,
    `Animaux: ${prospect.hasPets ? "oui" : "non"}`,
    `Stationnement: ${prospect.needsParking ? "oui" : "non"}`,
    prospect.availabilityNotes ? `Disponibilites visite: ${cleanText(prospect.availabilityNotes)}` : null,
    prospect.notes ? cleanText(prospect.notes) : null,
  ].filter(Boolean).join("\n\n");

  const prospectPayload = {
    name: cleanText(prospect.name),
    phone: normalizedPhone || cleanText(prospect.phone),
    email: normalizedEmail || null,
    preferredLanguage: prospect.preferredLanguage,
    maxBudget: prospect.maxBudget,
    preferredDistricts: prospect.preferredDistricts.map((district) => cleanText(district)),
    bedroomsNeeded: prospect.bedroomsNeeded,
    moveInDate: prospect.moveInDate ? new Date(prospect.moveInDate) : null,
    hasPets: prospect.hasPets,
    needsParking: prospect.needsParking,
    firstContactPropertyId: existingProspect?.firstContactPropertyId || property.id,
    notes: mergedNotes || null,
    status: "VISIT_REQUESTED" as const,
    lastContactAt: new Date(),
  };

  const prospectRecord = existingProspect
    ? await prisma.prospect.update({ where: { id: existingProspect.id }, data: prospectPayload })
    : await prisma.prospect.create({ data: prospectPayload });

  const startsAt = new Date(visit.startsAt);
  const endsAt = visit.endsAt ? new Date(visit.endsAt) : new Date(startsAt.getTime() + 30 * 60 * 1000);
  const idempotencyKey = `public-${property.id}-${prospectRecord.id}-${startsAt.getTime()}`;

  const existingVisit = await prisma.visit.findUnique({ where: { idempotencyKey } });
  if (existingVisit) {
    return NextResponse.json({ ok: true, item: existingVisit, duplicate: true });
  }

  const visitRecord = await prisma.visit.create({
    data: {
      prospectId: prospectRecord.id,
      propertyId: property.id,
      startsAt,
      endsAt,
      notes: mergedNotes || null,
      internalNotes: "SOURCE: SITE_PUBLIC",
      status: "PENDING_APPROVAL",
      idempotencyKey,
    },
    include: { prospect: true, property: true },
  });

  await writeAuditLog({
    entity: "Visit",
    entityId: visitRecord.id,
    action: "PUBLIC_VISIT_REQUESTED",
    metadata: {
      source: "SITE_PUBLIC",
      propertyId: property.id,
      prospectId: prospectRecord.id,
      rentalUnitId: visit.rentalUnitId || null,
      startsAt: startsAt.toISOString(),
    },
  });

  return NextResponse.json({ ok: true, item: visitRecord });
}
