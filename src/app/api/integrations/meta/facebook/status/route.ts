import { NextResponse } from "next/server";
import { getMetaStatus } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const status = await getMetaStatus(auth.user!.id);
    return NextResponse.json(status);
  } catch {
    return safeServerError();
  }
}
