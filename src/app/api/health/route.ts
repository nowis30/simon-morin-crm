import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DB_PING_TIMEOUT_MS = 1200;

async function pingDatabaseWithTimeout() {
  await Promise.race([
    prisma.$queryRaw`SELECT 1`,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("DB ping timeout")), DB_PING_TIMEOUT_MS);
    }),
  ]);
}

export async function GET() {
  let database = "down";

  try {
    await pingDatabaseWithTimeout();
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
