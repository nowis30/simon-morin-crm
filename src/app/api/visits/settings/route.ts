import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";
import { getOrCreateVisitAvailabilitySettings, updateVisitAvailabilitySettings } from "@/lib/visits";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { visitAvailabilitySettingsSchema } from "@/lib/validators";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const item = await getOrCreateVisitAvailabilitySettings(auth.user!.id);
    return NextResponse.json({ item });
  } catch {
    return safeServerError();
  }
}

export async function PATCH(request: NextRequest) {
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
    const parsed = visitAvailabilitySettingsSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Parametres invalides" }, { status: 400 });
    }

    const item = await updateVisitAvailabilitySettings(auth.user!.id, parsed.data);
    return NextResponse.json({ item });
  } catch {
    return safeServerError();
  }
}
