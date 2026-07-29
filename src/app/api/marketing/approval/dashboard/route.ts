import { PublicationChannel } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildChannelStats } from "@/lib/marketing-approval";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const byStatus = await prisma.advertisement.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const channelRows = await prisma.advertisementPublication.findMany({
      select: {
        channel: true,
        messagesReceived: true,
        prospectsCount: true,
        visitsCount: true,
        placementsCount: true,
        commissionAmount: true,
      },
      where: { status: "PUBLISHED" },
    });

    const byChannel = buildChannelStats(
      channelRows.map((row) => ({
        channel: row.channel as PublicationChannel,
        messages: row.messagesReceived,
        prospects: row.prospectsCount,
        visits: row.visitsCount,
        placements: row.placementsCount,
        commission: row.commissionAmount,
      })),
    );

    const needsAction = await prisma.advertisement.count({
      where: { status: { in: ["MANUAL_ACTION_REQUIRED", "FAILED", "CHANGES_REQUESTED", "READY_FOR_REVIEW"] } },
    });

    return NextResponse.json({ byStatus, byChannel, needsAction });
  } catch {
    return safeServerError();
  }
}
