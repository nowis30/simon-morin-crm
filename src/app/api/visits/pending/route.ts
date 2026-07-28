import { VisitStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const items = await prisma.visit.findMany({
      where: { status: VisitStatus.PENDING_APPROVAL },
      include: { prospect: true, property: true },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json({ items });
  } catch {
    return safeServerError();
  }
}
