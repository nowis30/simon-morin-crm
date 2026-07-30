import { NextResponse } from "next/server";
import { getMetaDiagnostic } from "@/lib/meta-facebook";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const status = await getMetaDiagnostic(auth.user!.id);
    return NextResponse.json(status);
  } catch {
    return safeServerError();
  }
}
