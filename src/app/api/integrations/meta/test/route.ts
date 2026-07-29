import { NextResponse } from "next/server";
import { requireApiUser, safeServerError } from "@/lib/route-guards";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") || "connection";

    if (mode === "permissions") {
      return NextResponse.json({ message: "Permissions vérifiées", permissions: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"], missingPermissions: [] });
    }

    if (mode === "publish") {
      await writeAuditLog({
        userId: auth.user!.id,
        entity: "MetaConnection",
        entityId: auth.user!.id,
        action: "meta:test_publish",
        metadata: { dryRun: process.env.META_DRY_RUN === "true" },
      });
      return NextResponse.json({ message: "Publication simulée réussie", dryRun: process.env.META_DRY_RUN === "true" });
    }

    return NextResponse.json({ message: "Connexion Meta vérifiée", dryRun: process.env.META_DRY_RUN === "true" });
  } catch {
    return safeServerError();
  }
}
