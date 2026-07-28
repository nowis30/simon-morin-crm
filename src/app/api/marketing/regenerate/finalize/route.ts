import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";
import { writeAuditLog } from "@/lib/audit";
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

    const report = (await request.json()) as Record<string, unknown>;
    await writeAuditLog({
      userId: auth.user!.id,
      entity: "Advertisement",
      entityId: "bulk-regeneration",
      action: "REGENERATE_ADVERTISEMENTS",
      metadata: report,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return safeServerError();
  }
}