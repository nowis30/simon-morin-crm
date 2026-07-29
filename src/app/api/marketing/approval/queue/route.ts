import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const status = request.nextUrl.searchParams.get("status") || undefined;
    const propertyId = request.nextUrl.searchParams.get("propertyId") || undefined;

    const items = await prisma.advertisement.findMany({
      where: {
        propertyId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        property: { include: { photos: { orderBy: { sortOrder: "asc" } } } },
        versions: { orderBy: { createdAt: "desc" }, take: 10 },
        selectedPhotos: { orderBy: [{ channel: "asc" }, { isPrimary: "desc" }, { sortOrder: "asc" }] },
        publications: { orderBy: { createdAt: "desc" } },
        groupPublications: { include: { group: true }, orderBy: { createdAt: "desc" } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 250,
    });

    return NextResponse.json({ items });
  } catch {
    return safeServerError();
  }
}
