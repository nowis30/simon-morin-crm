import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { buildRegenerationPreview, type GenerationMode } from "@/lib/marketing";

function getMode(mode: string | null): GenerationMode {
  if (mode === "AUTOMATIC_ONLY" || mode === "FORCE_ALL") {
    return mode;
  }
  return "INCOMPLETE_ONLY";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const mode = getMode(request.nextUrl.searchParams.get("mode"));
    const properties = await prisma.property.findMany({
      where: { status: { notIn: ["RENTED", "REMOVED", "ARCHIVED"] } },
      include: { photos: { orderBy: { sortOrder: "asc" } } },
      orderBy: { codeIsr: "asc" },
    });
    const ads = await prisma.advertisement.findMany({
      where: { propertyId: { in: properties.map((property) => property.id) } },
    });

    const preview = buildRegenerationPreview(properties, ads, mode);
    return NextResponse.json(preview);
  } catch {
    return safeServerError();
  }
}