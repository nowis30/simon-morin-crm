import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAdvertisementDrafts } from "@/lib/marketing";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET(_request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const { propertyId } = await params;
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { photos: true },
    });

    if (!property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const previewItems = createAdvertisementDrafts(property);
    return NextResponse.json({ items: previewItems });
  } catch {
    return safeServerError();
  }
}
