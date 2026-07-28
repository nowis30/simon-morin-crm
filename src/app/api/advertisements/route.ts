import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const items = await prisma.advertisement.findMany({
      include: { property: { include: { photos: true } }, versions: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ items });
  } catch {
    return safeServerError();
  }
}
