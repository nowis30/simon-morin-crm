import { describe, expect, it } from "vitest";
import { formatPublicAddress, getPublicFeatures, isPublicPropertyVisible } from "@/lib/public-listings";

describe("public listings helpers", () => {
  it("retire le numéro civique et l'appartement de l'adresse publique", () => {
    expect(formatPublicAddress("123 Rue Lagacé #315")).toBe("Rue Lagacé");
    expect(formatPublicAddress("45 Boulevard Saint-Jean, apt 2")).toBe("Boulevard Saint-Jean");
  });

  it("construit des caractéristiques publiques lisibles", () => {
    const features = getPublicFeatures({
      petsAllowed: true,
      parking: true,
      inclusions: "Laveuse et sécheuse, climatisation",
    });

    expect(features).toContain("Chat accepté");
    expect(features).toContain("Stationnement inclus");
    expect(features).toContain("Laveuse et sécheuse");
  });

  it("ne montre que les logements visibles au public", () => {
    expect(isPublicPropertyVisible("AVAILABLE")).toBe(true);
    expect(isPublicPropertyVisible("VISIT_SCHEDULED")).toBe(true);
    expect(isPublicPropertyVisible("RENTED")).toBe(false);
  });
});
