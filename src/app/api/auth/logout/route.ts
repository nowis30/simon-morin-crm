import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { validateCsrfRequest } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  if (!(await validateCsrfRequest(request))) {
    return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true }, {
    headers: { "Cache-Control": "no-store", "Clear-Site-Data": '"cache"' },
  });
}
