import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { buildSyncComparisonReport, type SyncSnapshot } from "@/lib/gestion-isr-sync";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const properties = await prisma.property.findMany({
      where: { gestionIsrUrl: { not: null } },
      include: { photos: { select: { url: true }, orderBy: { sortOrder: "asc" } } },
      orderBy: { codeIsr: "asc" },
    });

    const audits = await prisma.auditLog.findMany({
      where: { entity: "Property", action: "SYNC_GESTION_ISR" },
      orderBy: { createdAt: "desc" },
      take: 2,
    });

    const previousSnapshot = (audits[1]?.metadata as { snapshot?: SyncSnapshot } | null)?.snapshot ?? null;
    const report = buildSyncComparisonReport(properties, previousSnapshot);

    return NextResponse.json(report);
  } catch {
    return safeServerError();
  }
}