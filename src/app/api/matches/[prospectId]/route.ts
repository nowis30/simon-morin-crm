import { PropertyStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { calculateMatchScore } from "@/lib/match-score";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET(_request: Request, { params }: { params: Promise<{ prospectId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const { prospectId } = await params;

    const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
    if (!prospect) {
      return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
    }

    const properties = await prisma.property.findMany({
      where: { status: PropertyStatus.AVAILABLE },
      orderBy: [{ marketingPriority: "desc" }, { monthlyPrice: "asc" }],
    });

    const results = [];

    for (const property of properties) {
      const result = calculateMatchScore({
        prospect: {
          maxBudget: prospect.maxBudget,
          preferredDistricts: prospect.preferredDistricts,
          bedroomsNeeded: prospect.bedroomsNeeded,
          moveInDate: prospect.moveInDate,
          hasPets: prospect.hasPets,
          needsParking: prospect.needsParking,
        },
        property: {
          monthlyPrice: property.monthlyPrice,
          district: property.district,
          bedrooms: property.bedrooms,
          availableFrom: property.availableFrom,
          petsAllowed: property.petsAllowed,
          parking: property.parking,
        },
      });

      const saved = await prisma.prospectPropertyMatch.upsert({
        where: {
          prospectId_propertyId: {
            prospectId: prospect.id,
            propertyId: property.id,
          },
        },
        update: {
          ...result,
        },
        create: {
          prospectId: prospect.id,
          propertyId: property.id,
          ...result,
        },
      });

      results.push({ property, match: saved });
    }

    return NextResponse.json({ items: results.sort((a, b) => b.match.score - a.match.score) });
  } catch {
    return safeServerError();
  }
}
