import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) return auth.response;
    const year = Number(request.nextUrl.searchParams.get("year") || new Date().getFullYear());
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const trips = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT * FROM "MileageTrip"
      WHERE "userId" = ${auth.user!.id} AND "tripDate" >= ${start} AND "tripDate" < ${end}
      ORDER BY "tripDate" ASC
    `);

    const csv = toCsv(trips.map((trip) => ({
      date: new Date(String(trip.tripDate)).toISOString().slice(0, 10),
      départ: trip.originAddress,
      destination: trip.destinationAddress,
      raison_affaires: trip.purpose,
      km_aller: trip.oneWayKm,
      aller_retour: trip.roundTrip ? "Oui" : "Non",
      km_affaires: trip.businessKm,
      stationnement: trip.parkingAmount,
      péages: trip.tollAmount,
      source_distance: trip.distanceSource,
      notes: trip.notes ?? "",
    })));

    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="registre-kilometrage-${year}.csv"`,
      },
    });
  } catch (error) {
    console.error("Mileage export failed", error);
    return safeServerError();
  }
}
