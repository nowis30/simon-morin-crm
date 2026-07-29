import { NextResponse } from "next/server";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const pageId = typeof body?.pageId === "string" ? body.pageId : null;
    const pageName = typeof body?.pageName === "string" ? body.pageName : null;

    if (!pageId) {
      return NextResponse.json({ error: "Page Meta manquante" }, { status: 400 });
    }

    await writeAuditLog({
      userId: auth.user!.id,
      entity: "MetaConnection",
      entityId: auth.user!.id,
      action: "meta:select_page",
      metadata: { pageId, pageName },
    });

    return NextResponse.json({ message: "Page sélectionnée", pageId, pageName });
  } catch {
    return safeServerError();
  }
}
