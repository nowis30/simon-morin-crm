import { NextResponse } from "next/server";
import { getOrCreateCsrfToken } from "@/lib/csrf";

export async function GET() {
  const token = await getOrCreateCsrfToken();
  return NextResponse.json({ token });
}
