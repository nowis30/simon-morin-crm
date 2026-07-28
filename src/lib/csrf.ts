import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { env } from "@/lib/env";

const CSRF_COOKIE = "simon_csrf";

export async function getOrCreateCsrfToken() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE)?.value;

  if (existing) {
    return existing;
  }

  const token = crypto.randomBytes(32).toString("hex");
  cookieStore.set({
    name: CSRF_COOKIE,
    value: token,
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return token;
}

export async function validateCsrfToken(headerToken: string | null) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE)?.value;
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}

export async function validateCsrfRequest(request: NextRequest) {
  const headerToken = request.headers.get("x-csrf-token");
  if (await validateCsrfToken(headerToken)) {
    return true;
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return false;
  }

  try {
    const formData = await request.formData();
    const formToken = formData.get("csrfToken");
    return await validateCsrfToken(typeof formToken === "string" ? formToken : null);
  } catch {
    return false;
  }
}