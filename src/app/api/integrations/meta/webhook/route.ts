import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { writeAuditLog } from "@/lib/audit";
import { env } from "@/lib/env";

function isValidMetaSignature(body: string, signatureHeader: string | null): boolean {
  const secret = env.META_APP_SECRET;
  if (!secret || !signatureHeader) {
    return false;
  }
  const expected = `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);
  return received.length === computed.length && timingSafeEqual(received, computed);
}

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

    if (!isValidMetaSignature(body, request.headers.get("x-hub-signature-256"))) {
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }

    await writeAuditLog({
      entity: "MetaWebhook",
      entityId: "webhook",
      action: "meta:webhook_received",
      metadata: { verified: true },
    });

    return NextResponse.json({ success: true, message: "Webhook reçu, traitement non activé pour l’instant" });
  } catch {
    return NextResponse.json({ error: "Webhook invalide" }, { status: 400 });
  }
}
