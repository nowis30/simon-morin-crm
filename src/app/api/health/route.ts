import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let database = "down";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  return NextResponse.json(
    {
      status: "ok",
      app: "up",
      database,
      serverTime: new Date().toISOString(),
    },
    { status: 200 },
  );
}
