import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { cleanText } from "@/lib/sanitize";
import { publicVisitSubmissionSchema } from "@/lib/validators";

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

  const prospectRecord = await prisma.prospect.create({
    data: {
      name: cleanText(prospect.name),
      phone: cleanText(prospect.phone),
      email: cleanText(prospect.email) || null,
      preferredLanguage: prospect.preferredLanguage,
      maxBudget: prospect.maxBudget,
      preferredDistricts: prospect.preferredDistricts.map((district) => cleanText(district)),
      bedroomsNeeded: prospect.bedroomsNeeded,
      moveInDate: prospect.moveInDate ? new Date(prospect.moveInDate) : null,
      hasPets: prospect.hasPets,
      needsParking: prospect.needsParking,
      firstContactPropertyId: property.id,
      notes: cleanText(prospect.notes),
      status: "VISIT_REQUESTED",
      lastContactAt: new Date(),
    },
  });

  const startsAt = new Date(visit.startsAt);
  const endsAt = visit.endsAt ? new Date(visit.endsAt) : new Date(startsAt.getTime() + 30 * 60 * 1000);

  const visitRecord = await prisma.visit.create({
    data: {
      prospectId: prospectRecord.id,
      propertyId: property.id,
      startsAt,
      endsAt,
      notes: cleanText(prospect.notes),
      status: "PENDING_APPROVAL",
      idempotencyKey: `public-${prospectRecord.id}-${property.id}-${startsAt.getTime()}`,
    },
    include: { prospect: true, property: true },
  });

  await writeAuditLog({
    entity: "Visit",
    entityId: visitRecord.id,
    action: "PUBLIC_VISIT_REQUESTED",
    metadata: { propertyId: property.id, prospectId: prospectRecord.id, startsAt: startsAt.toISOString() },
  });

  return NextResponse.json({ ok: true, item: visitRecord });
}
