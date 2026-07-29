import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { suggestGroupsForProperty } from "@/lib/marketing-approval";

export async function GET(_: Request, { params }: { params: Promise<{ adId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const { adId } = await params;
    const ad = await prisma.advertisement.findUnique({
      where: { id: adId },
      include: {
        property: true,
        groupPublications: { include: { group: true }, orderBy: { createdAt: "desc" } },
      },
    });

    if (!ad || !ad.property) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    const groups = await prisma.facebookGroup.findMany({ where: { active: true }, orderBy: [{ city: "asc" }, { name: "asc" }] });

    const suggestions = suggestGroupsForProperty({
      propertyCity: ad.property.city,
      propertyDistrict: ad.property.district,
      language: ad.language.toLowerCase(),
      groups,
    }).map((suggestion) => {
      const group = groups.find((item) => item.id === suggestion.groupId)!;
      const existing = ad.groupPublications.find((item) => item.groupId === group.id) || null;
      return {
        group,
        suggestion,
        existing,
      };
    });

    return NextResponse.json({
      advertisement: {
        id: ad.id,
        title: ad.title,
        body: ad.body,
        type: ad.type,
        language: ad.language,
        status: ad.status,
      },
      property: ad.property,
      suggestions,
    });
  } catch {
    return safeServerError();
  }
}
