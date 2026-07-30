import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { confirmManualFacebookPublication } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { confirmManualFacebookPublicationSchema } from "@/lib/validators";

export async function POST(request: NextRequest, { params }: { params: Promise<{ adId: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfRequest(request);
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { adId } = await params;
    const body = await request.json();
    const parsed = confirmManualFacebookPublicationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    try {
      const item = await confirmManualFacebookPublication({
        advertisementId: adId,
        userId: auth.user!.id,
        publicationUrl: parsed.data.publicationUrl,
      });
      return NextResponse.json({ item });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Confirmation manuelle impossible";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch {
    return safeServerError();
  }
}
