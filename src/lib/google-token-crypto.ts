import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { env } from "@/lib/env";

function getEncryptionKey() {
  if (!env.GOOGLE_TOKEN_ENCRYPTION_KEY) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY manquant");
  }
  return createHash("sha256").update(env.GOOGLE_TOKEN_ENCRYPTION_KEY).digest();
}

export function encryptToken(plainText: string) {
  const iv = randomBytes(12);
  const key = getEncryptionKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptToken(cipherText: string) {
  const payload = Buffer.from(cipherText, "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
