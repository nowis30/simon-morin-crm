import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { calculateBusinessKm, calculateVehicleSummary } from "@/lib/mileage";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

const tripSchema = z.object({
  visitId: z.string().optional().nullable(),
  tripDate: z.string().datetime(),
  originAddress: z.string().trim().min(5).max(300),
  destinationAddress: z.string().trim().min(5).max(300),
  purpose: z.string().trim().min(2).max(300),
  oneWayKm: z.number().positive().max(5000),
  roundTrip: z.boolean().default(true),
  parkingAmount: z.number().min(0).max(10000).default(0),
  tollAmount: z.number().min(0).max(10000).default(0),
  distanceSource: z.enum(["MANUAL", "GOOGLE_ROUTES", "ODOMETER"]).default("MANUAL"),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

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
      ORDER BY "tripDate" DESC
    `);
    const yearRows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT * FROM "MileageYear" WHERE "userId" = ${auth.user!.id} AND "year" = ${year} LIMIT 1
    `);
    const settingsRows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT * FROM "MileageSettings" WHERE "userId" = ${auth.user!.id} LIMIT 1
    `);

    const businessKm = trips.reduce((sum, trip) => sum + Number(trip.businessKm || 0), 0);
    const parkingAndTolls = trips.reduce((sum, trip) => sum + Number(trip.parkingAmount || 0) + Number(trip.tollAmount || 0), 0);
    const yearData = yearRows[0] ?? {};
    const vehicleExpenses = ["fuelAmount", "insuranceAmount", "registrationAmount", "maintenanceAmount", "interestAmount", "leaseAmount", "otherAmount"]
      .reduce((sum, key) => sum + Number(yearData[key] || 0), 0);
    const summary = calculateVehicleSummary({
      openingOdometerKm: Number(yearData.openingOdometerKm || 0),
      closingOdometerKm: Number(yearData.closingOdometerKm || 0),
      businessKm,
      vehicleExpenses,
      parkingAndTolls,
    });

    return NextResponse.json({ trips, year: yearRows[0] ?? null, settings: settingsRows[0] ?? null, summary: { ...summary, businessKm, parkingAndTolls, vehicleExpenses } });
  } catch (error) {
    console.error("Mileage GET failed", error);
    return safeServerError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) return auth.response;
    if (!(await validateCsrfToken(request.headers.get("x-csrf-token")))) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const parsed = tripSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    const data = parsed.data;
    const id = randomUUID();
    const businessKm = calculateBusinessKm(data.oneWayKm, data.roundTrip);

    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "MileageTrip" (
        "id", "userId", "visitId", "tripDate", "originAddress", "destinationAddress", "purpose",
        "oneWayKm", "businessKm", "roundTrip", "parkingAmount", "tollAmount", "distanceSource", "notes", "createdAt", "updatedAt"
      ) VALUES (
        ${id}, ${auth.user!.id}, ${data.visitId || null}, ${new Date(data.tripDate)}, ${data.originAddress}, ${data.destinationAddress},
        ${data.purpose}, ${data.oneWayKm}, ${businessKm}, ${data.roundTrip}, ${data.parkingAmount}, ${data.tollAmount},
        ${data.distanceSource}, ${data.notes || null}, NOW(), NOW()
      )
    `);
    await writeAuditLog({ userId: auth.user!.id, entity: "MileageTrip", entityId: id, action: "CREATE" });
    return NextResponse.json({ id, businessKm }, { status: 201 });
  } catch (error) {
    console.error("Mileage POST failed", error);
    return safeServerError();
  }
}
