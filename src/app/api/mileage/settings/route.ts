import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

const settingsSchema = z.object({
  homeAddress: z.string().trim().min(5).max(300),
  defaultRoundTrip: z.boolean().default(true),
  vehicleDescription: z.string().trim().max(200).optional().or(z.literal("")),
  year: z.number().int().min(2020).max(2100),
  openingOdometerKm: z.number().min(0),
  closingOdometerKm: z.number().min(0),
  fuelAmount: z.number().min(0),
  insuranceAmount: z.number().min(0),
  registrationAmount: z.number().min(0),
  maintenanceAmount: z.number().min(0),
  interestAmount: z.number().min(0),
  leaseAmount: z.number().min(0),
  otherAmount: z.number().min(0),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) return auth.response;
    const year = Number(request.nextUrl.searchParams.get("year") || new Date().getFullYear());

    const settings = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT * FROM "MileageSettings" WHERE "userId" = ${auth.user!.id} LIMIT 1
    `);
    const yearRows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT * FROM "MileageYear" WHERE "userId" = ${auth.user!.id} AND "year" = ${year} LIMIT 1
    `);

    return NextResponse.json({ settings: settings[0] ?? null, year: yearRows[0] ?? null });
  } catch (error) {
    console.error("Mileage settings GET failed", error);
    return safeServerError();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) return auth.response;
    if (!(await validateCsrfToken(request.headers.get("x-csrf-token")))) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    const data = parsed.data;

    await prisma.$transaction([
      prisma.$executeRaw(Prisma.sql`
        INSERT INTO "MileageSettings" ("userId", "homeAddress", "defaultRoundTrip", "vehicleDescription", "createdAt", "updatedAt")
        VALUES (${auth.user!.id}, ${data.homeAddress}, ${data.defaultRoundTrip}, ${data.vehicleDescription || null}, NOW(), NOW())
        ON CONFLICT ("userId") DO UPDATE SET
          "homeAddress" = EXCLUDED."homeAddress",
          "defaultRoundTrip" = EXCLUDED."defaultRoundTrip",
          "vehicleDescription" = EXCLUDED."vehicleDescription",
          "updatedAt" = NOW()
      `),
      prisma.$executeRaw(Prisma.sql`
        INSERT INTO "MileageYear" (
          "id", "userId", "year", "openingOdometerKm", "closingOdometerKm", "fuelAmount",
          "insuranceAmount", "registrationAmount", "maintenanceAmount", "interestAmount",
          "leaseAmount", "otherAmount", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${auth.user!.id}, ${data.year}, ${data.openingOdometerKm}, ${data.closingOdometerKm},
          ${data.fuelAmount}, ${data.insuranceAmount}, ${data.registrationAmount}, ${data.maintenanceAmount},
          ${data.interestAmount}, ${data.leaseAmount}, ${data.otherAmount}, NOW(), NOW()
        ) ON CONFLICT ("userId", "year") DO UPDATE SET
          "openingOdometerKm" = EXCLUDED."openingOdometerKm",
          "closingOdometerKm" = EXCLUDED."closingOdometerKm",
          "fuelAmount" = EXCLUDED."fuelAmount",
          "insuranceAmount" = EXCLUDED."insuranceAmount",
          "registrationAmount" = EXCLUDED."registrationAmount",
          "maintenanceAmount" = EXCLUDED."maintenanceAmount",
          "interestAmount" = EXCLUDED."interestAmount",
          "leaseAmount" = EXCLUDED."leaseAmount",
          "otherAmount" = EXCLUDED."otherAmount",
          "updatedAt" = NOW()
      `),
    ]);

    await writeAuditLog({ userId: auth.user!.id, entity: "MileageSettings", entityId: String(data.year), action: "UPSERT" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mileage settings PUT failed", error);
    return safeServerError();
  }
}
