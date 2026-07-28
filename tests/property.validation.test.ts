import { describe, expect, it } from "vitest";
import { propertyCreateSchema } from "@/lib/validators";

describe("property creation validation", () => {
  it("valide une creation de logement", () => {
    const parsed = propertyCreateSchema.safeParse({
      codeIsr: "ISR-XYZ-01",
      address: "10 Rue Test",
      city: "Quebec",
      monthlyPrice: 1200,
      propertyType: "Appartement",
      bedrooms: 2,
      petsAllowed: true,
      parking: true,
      descriptionFr: "Description francaise de test suffisante.",
      descriptionEn: "English test description that is long enough.",
      photoLinks: [],
    });

    expect(parsed.success).toBe(true);
  });
});
