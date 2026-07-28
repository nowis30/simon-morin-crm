import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";
import { disconnectGoogleCalendar } from "@/lib/google-calendar";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    await disconnectGoogleCalendar(auth.user!.id);
    return NextResponse.json({ ok: true });
  } catch {
    return safeServerError();
  }
}
