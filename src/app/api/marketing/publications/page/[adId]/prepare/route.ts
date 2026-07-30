import { NextRequest, NextResponse } from "next/server";
import { validateCsrfRequest } from "@/lib/csrf";
import { prepareManualFacebookPublication } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

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

    try {
      const item = await prepareManualFacebookPublication({
        advertisementId: adId,
        userId: auth.user!.id,
      });
      return NextResponse.json({ item });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preparation Facebook impossible";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch {
    return safeServerError();
  }
}
