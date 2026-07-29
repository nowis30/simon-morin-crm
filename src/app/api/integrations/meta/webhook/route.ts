import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.META_VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    await writeAuditLog({
      entity: "MetaWebhook",
      entityId: "webhook",
      action: "meta:webhook_received",
      metadata: { body: body.slice(0, 500) },
    });

    return NextResponse.json({ success: true, message: "Webhook reçu, traitement non activé pour l’instant" });
  } catch {
    return NextResponse.json({ error: "Webhook invalide" }, { status: 400 });
  }
}
