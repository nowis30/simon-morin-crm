import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { publishAdvertisementToMetaPage } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { publishPageSchema } from "@/lib/validators";

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
    const parsed = publishPageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    try {
      const publication = await publishAdvertisementToMetaPage({
        advertisementId: adId,
        userId: auth.user!.id,
        idempotencyKey: parsed.data.idempotencyKey,
      });
      return NextResponse.json({ item: publication });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Echec publication Facebook";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch {
    return safeServerError();
  }
}
