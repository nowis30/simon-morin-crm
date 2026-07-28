import { NextRequest, NextResponse } from "next/server";
import { isCsvMimeType, parseCsvText } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    if (!isCsvMimeType(request.headers.get("content-type"))) {
      return NextResponse.json({ error: "Type de fichier CSV requis" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsvText(text);

    let created = 0;

    for (const row of rows) {
      if (!row.codeIsr || !row.address || !row.city) {
        continue;
      }

      await prisma.property.upsert({
        where: { codeIsr: row.codeIsr },
        update: {
          address: row.address,
          city: row.city,
          district: row.district || null,
          monthlyPrice: Number(row.monthlyPrice || 0),
          propertyType: row.propertyType || "Appartement",
          bedrooms: Number(row.bedrooms || 0),
        },
        create: {
          codeIsr: row.codeIsr,
          address: row.address,
          city: row.city,
          district: row.district || null,
          monthlyPrice: Number(row.monthlyPrice || 0),
          propertyType: row.propertyType || "Appartement",
          bedrooms: Number(row.bedrooms || 0),
          descriptionFr: row.descriptionFr || "Description a completer",
          descriptionEn: row.descriptionEn || "Description to complete",
          petsAllowed: row.petsAllowed === "true",
          parking: row.parking === "true",
        },
      });

      created += 1;
    }

    return NextResponse.json({ ok: true, imported: created });
  } catch {
    return safeServerError();
  }
}
