import { AdvertisementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { buildAdvertisementVersionPayload } from "@/lib/marketing";
import { buildApprovalSummary, validateApprovalReadiness } from "@/lib/marketing-approval";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { approveAllContentsSchema } from "@/lib/validators";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = approveAllContentsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const items = await prisma.advertisement.findMany({
      where: { propertyId: parsed.data.propertyId },
      include: {
        property: { include: { photos: true } },
        selectedPhotos: { where: { excluded: false } },
      },
      orderBy: [{ type: "asc" }, { language: "asc" }],
    });

    if (items.length === 0) {
      return NextResponse.json({ error: "Aucun contenu marketing trouve" }, { status: 404 });
    }

    const checks = items.map((ad) => {
      const check = validateApprovalReadiness({
        ad,
        property: ad.property!,
        selectedPhotosCount: ad.selectedPhotos.length > 0 ? ad.selectedPhotos.length : ad.property!.photos.length,
        similarPublishedExists: false,
        recentPublicationExists: false,
      });
      return {
        ad,
        check,
      };
    });

    const blocked = checks.filter((item) => !item.check.canApprove);
    if (blocked.length > 0) {
      return NextResponse.json({
        error: "Impossible d'approuver tous les contenus",
        blocked: blocked.map((item) => ({
          advertisementId: item.ad.id,
          type: item.ad.type,
          language: item.ad.language,
          reasons: item.check.blocking,
        })),
      }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      for (const { ad, check } of checks) {
        await tx.advertisement.update({
          where: { id: ad.id },
          data: {
            status: AdvertisementStatus.APPROVED,
            approvedAt: new Date(),
            approvedByUserId: auth.user!.id,
            approvalWarnings: check.warnings,
            approvalNotes: "Validation complete des 6 contenus",
            versions: {
              create: {
                ...buildAdvertisementVersionPayload(ad, "APPROVAL_APPROVE_ALL"),
              },
            },
          },
        });
      }
    });

    const summary = buildApprovalSummary(
      checks.map((item) => ({
        channel: item.ad.type === "MARKETPLACE" ? "MARKETPLACE" : item.ad.type === "FACEBOOK_GROUP" ? "FACEBOOK_GROUP" : "PAGE",
        photos: item.ad.selectedPhotos.length > 0 ? item.ad.selectedPhotos.length : item.ad.property!.photos.length,
        incompleteFields: item.check.blocking,
        warnings: item.check.warnings,
      })),
      checks[0]?.ad.property?.lastVerificationDate ?? null,
    );

    await writeAuditLog({
      userId: auth.user!.id,
      entity: "Property",
      entityId: parsed.data.propertyId,
      action: "approval:approve_all",
      metadata: {
        approvedCount: checks.length,
        summary,
      },
    });

    return NextResponse.json({ ok: true, approved: checks.length, summary });
  } catch {
    return safeServerError();
  }
}
