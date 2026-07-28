import { NextRequest, NextResponse } from "next/server";
import { computeAvailableVisitSlots, getGoogleModeWarning } from "@/lib/visits";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { availableSlotsSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const payload = await request.json();
    const parsed = availableSlotsSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Parametres invalides" }, { status: 400 });
    }

    const result = await computeAvailableVisitSlots({
      userId: auth.user!.id,
      propertyId: parsed.data.propertyId,
      prospectId: parsed.data.prospectId,
      rangeStartIso: parsed.data.rangeStart,
      rangeEndIso: parsed.data.rangeEnd,
    });

    return NextResponse.json({
      slots: result.slots,
      timeZone: result.settings.timeZone,
      googleAvailabilitySource: result.googleSource,
      warning: getGoogleModeWarning(result.googleSource),
    });
  } catch {
    return safeServerError();
  }
}
