import { createHash, timingSafeEqual } from "node:crypto";

export function checkSetupToken(candidate: string | null, expected = process.env.SETUP_TOKEN): "unconfigured" | "invalid" | "valid" {
  if (!expected || Buffer.byteLength(expected, "utf8") < 32 || expected.length > 512) return "unconfigured";
  if (!candidate || candidate.length > 512) return "invalid";
  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(candidate), digest(expected)) ? "valid" : "invalid";
}
