import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/sanitize";
import { publicContactSubmissionSchema } from "@/lib/validators";

function normalizePhone(phone: string) {
  return cleanText(phone).replace(/\D/g, "");
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const parsed = publicContactSubmissionSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  if (parsed.data.honeypot?.trim()) {
    return NextResponse.json({ ok: true });
  }

  const normalizedPhone = normalizePhone(parsed.data.phone);
  const normalizedEmail = cleanText(parsed.data.email).toLowerCase();

  const existingProspect = await prisma.prospect.findFirst({
    where: {
      OR: [
        { phone: normalizedPhone },
        ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ],
    },
  });

  const now = new Date();
  const message = cleanText(parsed.data.message);
  const preferredMethod = parsed.data.preferredContactMethod;

  const duplicateSince = new Date(now.getTime() - 5 * 60 * 1000);

  const prospect = existingProspect
    ? await prisma.prospect.update({
        where: { id: existingProspect.id },
        data: {
          name: cleanText(parsed.data.name),
          phone: normalizedPhone || cleanText(parsed.data.phone),
          email: normalizedEmail || null,
          status: "TO_CONTACT",
          lastContactAt: now,
          notes: [existingProspect.notes, `Contact public: ${message}`].filter(Boolean).join("\n\n").slice(0, 1500),
        },
      })
    : await prisma.prospect.create({
        data: {
          name: cleanText(parsed.data.name),
          phone: normalizedPhone || cleanText(parsed.data.phone),
          email: normalizedEmail || null,
          preferredLanguage: "fr",
          status: "TO_CONTACT",
          notes: `Contact public: ${message}`,
          lastContactAt: now,
        },
      });

  const duplicateInteraction = await prisma.prospectInteraction.findFirst({
    where: {
      prospectId: prospect.id,
      summary: message,
      createdAt: { gte: duplicateSince },
    },
  });

  if (!duplicateInteraction) {
    await prisma.prospectInteraction.create({
      data: {
        prospectId: prospect.id,
        type: preferredMethod,
        summary: message,
      },
    });
  }

  await writeAuditLog({
    entity: "Prospect",
    entityId: prospect.id,
    action: "SITE_PUBLIC_CONTACT",
    metadata: {
      source: "SITE_PUBLIC_CONTACT",
      preferredContactMethod: preferredMethod,
      duplicate: Boolean(duplicateInteraction),
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Votre message a ete envoye. Simon communiquera avec vous rapidement.",
  });
}
