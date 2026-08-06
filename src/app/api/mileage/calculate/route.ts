import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateCsrfToken } from "@/lib/csrf";
import { calculateBusinessKm, calculateDrivingDistance } from "@/lib/mileage";
import { requireApiUser } from "@/lib/route-guards";

const schema = z.object({
  originAddress: z.string().trim().min(5),
  destinationAddress: z.string().trim().min(5),
  roundTrip: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!(await validateCsrfToken(request.headers.get("x-csrf-token")))) {
    return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Adresses invalides" }, { status: 400 });

  try {
    const result = await calculateDrivingDistance(parsed.data.originAddress, parsed.data.destinationAddress);
    return NextResponse.json({
      oneWayKm: result.oneWayKm,
      businessKm: calculateBusinessKm(result.oneWayKm, parsed.data.roundTrip),
      source: result.source,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "DISTANCE_FAILED";
    const message = code === "GOOGLE_MAPS_API_KEY_NOT_CONFIGURED"
      ? "Le calcul automatique n'est pas configuré. Entre la distance manuellement."
      : "Impossible de calculer cette route. Vérifie les adresses ou entre la distance manuellement.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
