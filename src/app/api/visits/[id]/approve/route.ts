import { VisitStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { createGoogleCalendarEvent, getGoogleConnectionStatus } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { visitApprovalSchema } from "@/lib/validators";
import { assertVisitSlotStillAvailable, buildVisitEventPayload, updateVisitStatusesAfterApproval } from "@/lib/visits";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const parsed = visitApprovalSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const { id } = await params;
    const currentVisit = await prisma.visit.findUnique({
      where: { id },
      include: { prospect: true, property: true },
    });

    if (!currentVisit) {
      return NextResponse.json({ error: "Visite introuvable" }, { status: 404 });
    }

    if (!parsed.data.approved) {
      const refused = await prisma.visit.update({
        where: { id },
        data: {
          status: VisitStatus.REFUSED,
          approvedAt: null,
          refusedAt: new Date(),
          notes: cleanText(parsed.data.notes),
        },
        include: { prospect: true, property: true },
      });

      await prisma.prospect.update({
        where: { id: refused.prospectId },
        data: { status: "TO_CONTACT" },
      });

      await writeAuditLog({
        userId: auth.user!.id,
        entity: "Visit",
        entityId: refused.id,
        action: "REFUSE",
      });

      return NextResponse.json({ item: refused });
    }

    const recheck = await assertVisitSlotStillAvailable({
      userId: auth.user!.id,
      startsAtIso: currentVisit.startsAt.toISOString(),
      endsAtIso: currentVisit.endsAt.toISOString(),
      ignoreVisitId: currentVisit.id,
    });

    if (!recheck.ok) {
      return NextResponse.json({ error: "La plage est devenue occupee. Choisis une autre heure." }, { status: 409 });
    }

    const googleStatus = await getGoogleConnectionStatus(auth.user!.id);
    let googleEventId: string | null = null;
    let googleEventHtmlLink: string | null = null;
    let googleSyncStatus = "MANUAL_NO_GOOGLE";

    if (googleStatus.connected) {
      try {
        const payloadEvent = buildVisitEventPayload(currentVisit);
        const createdEvent = await createGoogleCalendarEvent({
          userId: auth.user!.id,
          summary: payloadEvent.summary,
          description: payloadEvent.description,
          location: payloadEvent.location,
          startsAtIso: payloadEvent.startsAtIso,
          endsAtIso: payloadEvent.endsAtIso,
        });
        googleEventId = createdEvent.eventId;
        googleEventHtmlLink = createdEvent.eventLink;
        googleSyncStatus = "SYNCED";
      } catch {
        return NextResponse.json({ error: "Impossible de creer l'evenement Google. La demande reste en attente." }, { status: 502 });
      }
    }

    const updatedCount = await prisma.visit.updateMany({
      where: { id: currentVisit.id, status: VisitStatus.PENDING_APPROVAL },
      data: {
        status: VisitStatus.CONFIRMED,
        approvedAt: new Date(),
        refusedAt: null,
        notes: cleanText(parsed.data.notes) || currentVisit.notes,
        googleEventId,
        googleEventHtmlLink,
        googleSyncStatus,
      },
    });

    if (updatedCount.count === 0) {
      return NextResponse.json({ error: "La visite a deja ete traitee par une autre requete." }, { status: 409 });
    }

    const visit = await prisma.visit.findUnique({
      where: { id: currentVisit.id },
      include: { prospect: true, property: true },
    });

    if (!visit) {
      return NextResponse.json({ error: "Visite introuvable" }, { status: 404 });
    }

    await updateVisitStatusesAfterApproval({
      visitId: visit.id,
      prospectId: visit.prospectId,
      propertyId: visit.propertyId,
    });

    await writeAuditLog({
      userId: auth.user!.id,
      entity: "Visit",
      entityId: visit.id,
      action: "APPROVE",
      metadata: {
        googleEventLinked: Boolean(visit.googleEventId),
        googleSyncStatus: visit.googleSyncStatus,
      },
    });

    return NextResponse.json({ item: visit });
  } catch {
    return safeServerError();
  }
}
