import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const signedRequest = typeof body?.signed_request === "string" ? body.signed_request : null;

    if (!signedRequest) {
      return NextResponse.json({ error: "Demande Meta invalide" }, { status: 400 });
    }

    await writeAuditLog({
      userId: auth.user!.id,
      entity: "MetaDataDeletion",
      entityId: auth.user!.id,
      action: "meta:data_deletion_request",
      metadata: { signedRequest: signedRequest.slice(0, 20) },
    });

    return NextResponse.json({
      success: true,
      message: "Demande de suppression reçue. Une vérification humaine sera effectuée avant toute suppression définitive.",
    });
  } catch {
    return safeServerError();
  }
}
