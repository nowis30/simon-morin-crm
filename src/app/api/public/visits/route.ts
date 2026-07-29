import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/sanitize";
import { prospectCreateSchema, visitCreateSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const payload = await request.json();
  const prospectParsed = prospectCreateSchema.safeParse(payload.prospect);
  const visitParsed = visitCreateSchema.safeParse(payload.visit);

  if (!prospectParsed.success || !visitParsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  const prospect = await prisma.prospect.create({
    data: {
      name: cleanText(prospectParsed.data.name),
      phone: cleanText(prospectParsed.data.phone),
      email: cleanText(prospectParsed.data.email) || null,
      preferredLanguage: prospectParsed.data.preferredLanguage,
      maxBudget: prospectParsed.data.maxBudget,
      preferredDistricts: prospectParsed.data.preferredDistricts.map((district) => cleanText(district)),
      bedroomsNeeded: prospectParsed.data.bedroomsNeeded,
      moveInDate: prospectParsed.data.moveInDate ? new Date(prospectParsed.data.moveInDate) : null,
      hasPets: prospectParsed.data.hasPets,
      needsParking: prospectParsed.data.needsParking,
      firstContactPropertyId: visitParsed.data.propertyId,
      notes: cleanText(prospectParsed.data.notes),
      status: "VISIT_REQUESTED",
      lastContactAt: new Date(),
    },
  });

  const startsAt = new Date(visitParsed.data.startsAt);
  const endsAt = visitParsed.data.endsAt ? new Date(visitParsed.data.endsAt) : new Date(startsAt.getTime() + 30 * 60 * 1000);

  const visit = await prisma.visit.create({
    data: {
      prospectId: prospect.id,
      propertyId: visitParsed.data.propertyId,
      startsAt,
      endsAt,
      notes: cleanText(prospectParsed.data.notes),
      status: "PENDING_APPROVAL",
      idempotencyKey: `public-${prospect.id}-${visitParsed.data.propertyId}-${startsAt.getTime()}`,
    },
    include: { prospect: true, property: true },
  });

  await prisma.property.update({
    where: { id: visitParsed.data.propertyId },
    data: { status: "VISIT_SCHEDULED" },
  });

  return NextResponse.json({ ok: true, item: visit });
}
