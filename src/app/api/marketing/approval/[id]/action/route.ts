import { AdvertisementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { buildAdvertisementVersionPayload } from "@/lib/marketing";
import { validateApprovalReadiness } from "@/lib/marketing-approval";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { advertisementApprovalSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = advertisementApprovalSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Action invalide" }, { status: 400 });
    }

    const ad = await prisma.advertisement.findUnique({
      where: { id },
      include: {
        property: { include: { photos: true } },
        selectedPhotos: { where: { excluded: false } },
      },
    });

    if (!ad || !ad.property) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    const similarPublishedExists = Boolean(
      await prisma.advertisement.findFirst({
        where: {
          id: { not: ad.id },
          propertyId: ad.propertyId,
          status: AdvertisementStatus.PUBLISHED,
          type: ad.type,
          language: ad.language,
        },
        select: { id: true },
      }),
    );

    const recentPublicationExists = Boolean(
      await prisma.advertisementPublication.findFirst({
        where: {
          advertisementId: ad.id,
          publishedAt: { gte: new Date(Date.now() - 72 * 60 * 60 * 1000) },
        },
        select: { id: true },
      }),
    );

    const readiness = validateApprovalReadiness({
      ad,
      property: ad.property,
      selectedPhotosCount: ad.selectedPhotos.length > 0 ? ad.selectedPhotos.length : ad.property.photos.length,
      similarPublishedExists,
      recentPublicationExists,
    });

    const notes = cleanText(parsed.data.notes);
    let nextStatus: AdvertisementStatus;
    let requiresManualAction = false;

    if (parsed.data.action === "APPROVE") {
      if (!readiness.canApprove) {
        return NextResponse.json({
          error: "Cette annonce ne peut pas etre approuvee",
          blocking: readiness.blocking,
          warnings: readiness.warnings,
        }, { status: 400 });
      }
      nextStatus = AdvertisementStatus.APPROVED;
    } else if (parsed.data.action === "REQUEST_CHANGES") {
      nextStatus = AdvertisementStatus.CHANGES_REQUESTED;
    } else if (parsed.data.action === "REJECT") {
      nextStatus = AdvertisementStatus.RETIRED;
    } else if (parsed.data.action === "CANCEL_APPROVAL") {
      nextStatus = AdvertisementStatus.READY_FOR_REVIEW;
    } else {
      nextStatus = AdvertisementStatus.MANUAL_ACTION_REQUIRED;
      requiresManualAction = true;
    }

    const updated = await prisma.advertisement.update({
      where: { id: ad.id },
      data: {
        status: nextStatus,
        approvedAt: nextStatus === AdvertisementStatus.APPROVED ? new Date() : null,
        approvedByUserId: nextStatus === AdvertisementStatus.APPROVED ? auth.user!.id : null,
        approvalNotes: notes || null,
        requiresManualAction,
        approvalWarnings: readiness.warnings,
        versions: {
          create: {
            ...buildAdvertisementVersionPayload(ad, `APPROVAL_${parsed.data.action}`),
          },
        },
      },
      include: {
        property: true,
        selectedPhotos: true,
        publications: { orderBy: { createdAt: "desc" } },
        groupPublications: { include: { group: true }, orderBy: { createdAt: "desc" } },
      },
    });

    await writeAuditLog({
      userId: auth.user!.id,
      entity: "Advertisement",
      entityId: ad.id,
      action: `approval:${parsed.data.action}`,
      metadata: {
        status: nextStatus,
        notes: notes || null,
        blocking: readiness.blocking,
        warnings: readiness.warnings,
      },
    });

    return NextResponse.json({ item: updated, checks: readiness });
  } catch {
    return safeServerError();
  }
}
