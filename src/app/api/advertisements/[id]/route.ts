import { AdvertisementStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { validateCsrfToken } from "@/lib/csrf";
import { prisma } from "@/lib/prisma";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { cleanText } from "@/lib/sanitize";
import { buildAdvertisementVersionPayload } from "@/lib/marketing";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const payload = (await request.json()) as {
      title?: string;
      body?: string;
      publicationUrl?: string;
      messagesReceived?: number;
      status?: AdvertisementStatus;
    };

    const title = cleanText(payload.title);
    const body = cleanText(payload.body);
    const existing = await prisma.advertisement.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Annonce introuvable" }, { status: 404 });
    }

    const updated = await prisma.advertisement.update({
      where: { id },
      data: {
        title: title || undefined,
        body: body || undefined,
        manuallyEdited: title || body ? true : undefined,
        publicationUrl: payload.publicationUrl || null,
        messagesReceived: payload.messagesReceived ?? undefined,
        status: payload.status ? (payload.status as AdvertisementStatus) : undefined,
        publishedAt: payload.status === "PUBLISHED" ? new Date() : undefined,
        versions:
          title || body
            ? {
                create: {
                  ...buildAdvertisementVersionPayload(existing, "MANUAL_EDIT"),
                },
              }
            : undefined,
      },
      include: { versions: { orderBy: { createdAt: "desc" } } },
    });

    return NextResponse.json({ item: updated });
  } catch {
    return safeServerError();
  }
}
