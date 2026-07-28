import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "simon_session";
const encoder = new TextEncoder();

type SessionPayload = {
  userId: string;
  email: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encoder.encode(env.SESSION_SECRET));
}

export async function readSessionToken(token: string) {
  const verified = await jwtVerify(token, encoder.encode(env.SESSION_SECRET));
  return verified.payload as SessionPayload;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;

  if (!session) {
    return null;
  }

  try {
    const payload = await readSessionToken(session);
    return prisma.user.findUnique({ where: { id: payload.userId } });
  } catch {
    return null;
  }
}

export async function hasAnyAdmin() {
  const count = await prisma.user.count();
  return count > 0;
}

export const AUTH_COOKIE_NAME = SESSION_COOKIE;