import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DB_PING_TIMEOUT_MS = 1200;

async function pingDatabaseWithTimeout() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("DB ping timeout")), DB_PING_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
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
      status: database === "up" ? "ok" : "degraded",
      app: "up",
      database,
      serverTime: new Date().toISOString(),
    },
    { status: database === "up" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
