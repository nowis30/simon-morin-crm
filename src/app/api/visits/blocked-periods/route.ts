import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";
import { createBlockedVisitPeriod, listBlockedVisitPeriods } from "@/lib/visits";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { visitBlockedPeriodCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const items = await listBlockedVisitPeriods(auth.user!.id);
    return NextResponse.json({ items });
  } catch {
    return safeServerError();
  }
}

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

    const payload = await request.json();
    const parsed = visitBlockedPeriodCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Periode invalide" }, { status: 400 });
    }

    if (new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) {
      return NextResponse.json({ error: "La fin doit etre apres le debut" }, { status: 400 });
    }

    const item = await createBlockedVisitPeriod(auth.user!.id, parsed.data);
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return safeServerError();
  }
}
