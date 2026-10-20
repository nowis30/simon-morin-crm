import { NextRequest, NextResponse } from "next/server";
import { getPublicCatalog } from "@/lib/public-catalog";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, safeServerError } from "@/lib/route-guards";

export async function GET(request: NextRequest) {
  if (!checkRateLimit(`public-catalog:${getClientIp(request)}`, 120, 15 * 60 * 1000).allowed) {
    return NextResponse.json({ error: "Trop de demandes, reessayez plus tard" }, { status: 429 });
  }
  try {
    return NextResponse.json(await getPublicCatalog(request.nextUrl.searchParams));
  } catch {
    return safeServerError();
  }
}
