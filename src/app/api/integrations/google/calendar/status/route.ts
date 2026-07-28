import { NextResponse } from "next/server";
import { getGoogleConnectionStatus } from "@/lib/google-calendar";
import { requireApiUser, safeServerError } from "@/lib/route-guards";

export async function GET() {
  try {
    const auth = await requireApiUser();
    if (auth.response) {
      return auth.response;
    }

    const status = await getGoogleConnectionStatus(auth.user!.id);
    return NextResponse.json(status);
  } catch {
    return safeServerError();
  }
}
