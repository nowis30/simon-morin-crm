import { describe, expect, it } from "vitest";
import { prospectCreateSchema } from "@/lib/validators";

describe("prospect creation validation", () => {
  it("valide une creation de prospect", () => {
    const parsed = prospectCreateSchema.safeParse({
      name: "Prospect Fictif",
      phone: "555-0101",
      email: "prospect@fictif.local",
      preferredLanguage: "fr",
      preferredDistricts: ["Limoilou"],
      hasPets: true,
      needsParking: false,
      status: "NEW",
    });

    expect(parsed.success).toBe(true);
  });
});
