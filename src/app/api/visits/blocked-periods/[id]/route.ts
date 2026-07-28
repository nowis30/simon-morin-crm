import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";
import { deleteBlockedVisitPeriod } from "@/lib/visits";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const csrfValid = await validateCsrfToken(request.headers.get("x-csrf-token"));
    if (!csrfValid) {
      return NextResponse.json({ error: "CSRF invalide" }, { status: 403 });
    }

    const { id } = await params;
    await deleteBlockedVisitPeriod(auth.user!.id, id);
    return NextResponse.json({ ok: true });
  } catch {
    return safeServerError();
  }
}
