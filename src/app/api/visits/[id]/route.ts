import { VisitStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { deleteGoogleCalendarEvent, getGoogleConnectionStatus, updateGoogleCalendarEvent } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { assertVisitSlotStillAvailable, buildVisitEventPayload, buildVisitMutationData } from "@/lib/visits";
import { visitMutationSchema } from "@/lib/validators";

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
    const parsed = visitMutationSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
    }

    const { id } = await params;
    const current = await prisma.visit.findUnique({
      where: { id },
      include: { prospect: true, property: true },
    });

    if (!current) {
      return NextResponse.json({ error: "Visite introuvable" }, { status: 404 });
    }

    if (parsed.data.action === "RESCHEDULE") {
      if (!parsed.data.startsAt || !parsed.data.endsAt) {
        return NextResponse.json({ error: "Nouvelle plage invalide" }, { status: 400 });
      }

      const check = await assertVisitSlotStillAvailable({
        userId: auth.user!.id,
        startsAtIso: parsed.data.startsAt,
        endsAtIso: parsed.data.endsAt,
        ignoreVisitId: current.id,
      });

      if (!check.ok) {
        return NextResponse.json({ error: "La nouvelle plage est occupee." }, { status: 409 });
      }

      if (current.status === VisitStatus.CONFIRMED && current.googleEventId) {
        const googleStatus = await getGoogleConnectionStatus(auth.user!.id);
        if (!googleStatus.connected) {
          return NextResponse.json({ error: "Reconnexion Google requise pour modifier une visite confirmee." }, { status: 409 });
        }

        const updatedVisitSnapshot = {
          ...current,
          startsAt: new Date(parsed.data.startsAt),
          endsAt: new Date(parsed.data.endsAt),
          notes: parsed.data.notes || current.notes,
        };
        const eventPayload = buildVisitEventPayload(updatedVisitSnapshot);
        await updateGoogleCalendarEvent({
          userId: auth.user!.id,
          eventId: current.googleEventId,
          summary: eventPayload.summary,
          description: eventPayload.description,
          location: eventPayload.location,
          startsAtIso: eventPayload.startsAtIso,
          endsAtIso: eventPayload.endsAtIso,
        });
      }
    }

    if (parsed.data.action === "CANCEL" && current.status === VisitStatus.CONFIRMED && current.googleEventId) {
      const googleStatus = await getGoogleConnectionStatus(auth.user!.id);
      if (!googleStatus.connected) {
        return NextResponse.json({ error: "Reconnexion Google requise pour annuler une visite confirmee." }, { status: 409 });
      }
      await deleteGoogleCalendarEvent({ userId: auth.user!.id, eventId: current.googleEventId });
    }

    const data = buildVisitMutationData(parsed.data.action, {
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      notes: parsed.data.notes,
    });

    const item = await prisma.visit.update({
      where: { id: current.id },
      data,
      include: { prospect: true, property: true },
    });

    await writeAuditLog({
      userId: auth.user!.id,
      entity: "Visit",
      entityId: item.id,
      action: parsed.data.action,
      metadata: {
        startsAt: item.startsAt,
        endsAt: item.endsAt,
      },
    });

    return NextResponse.json({ item });
  } catch {
    return safeServerError();
  }
}
