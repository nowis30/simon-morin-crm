import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth";

describe("auth", () => {
  it("hachage et verification du mot de passe", async () => {
    const plain = "MotdepasseComplexe!2026";
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    await expect(verifyPassword(plain, hash)).resolves.toBe(true);
    await expect(verifyPassword("mauvais", hash)).resolves.toBe(false);
  });
});
