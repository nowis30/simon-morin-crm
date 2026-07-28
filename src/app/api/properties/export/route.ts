import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { toCsv } from "@/lib/csv";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const items = await prisma.property.findMany({ include: { photos: { orderBy: { sortOrder: "asc" } } } });
    const rows = items.map((item) => ({
      id: item.id,
      codeIsr: item.codeIsr,
      address: item.address,
      city: item.city,
      district: item.district ?? "",
      monthlyPrice: item.monthlyPrice,
      propertyType: item.propertyType,
      bedrooms: item.bedrooms,
      status: item.status,
      photos: item.photos.map((photo) => photo.url).join(" | "),
    }));

    const csv = toCsv(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=logements.csv",
      },
    });
  } catch {
    return safeServerError();
  }
}
