import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMarketplacePublicText, buildMarketplaceZipPackage, type MarketplacePreparationRecord } from "@/lib/marketplace-package";

function createRecord(): MarketplacePreparationRecord {
  return {
    advertisementId: "ad-1",
    advertisementStatus: "APPROVED",
    title: "Logement disponible - Drummondville",
    body: "Texte brut",
    property: {
      id: "property-1",
      rentalUnitId: "unit-1",
      codeIsr: "ISR-123",
      address: "123 Rue Lagace #315",
      city: "Drummondville",
      district: "Centre",
      monthlyPrice: 1750,
      bedrooms: 3,
      propertyType: "Appartement",
      petsAllowed: true,
      petsDetails: null,
      parking: true,
      inclusions: "Thermopompe",
      availableFrom: null,
      status: "AVAILABLE",
      photos: [
        { id: "p1", url: "https://cdn.example.com/1.jpg", description: null, sortOrder: 0 },
        { id: "p2", url: "https://cdn.example.com/2.png", description: null, sortOrder: 1 },
      ],
    },
    selectedPhotos: [
      { propertyPhotoId: "p1", channel: "MARKETPLACE", sortOrder: 0, isPrimary: true, excluded: false },
      { propertyPhotoId: "p2", channel: "MARKETPLACE", sortOrder: 1, isPrimary: false, excluded: false },
    ],
  };
}

describe("marketplace package", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("genere un texte public avec coordonnees et lien public", () => {
    const result = buildMarketplacePublicText(createRecord());
    expect(result.text).toContain("Telephone : 819-388-3407");
    expect(result.text).toContain("Courriel : simonmorin@nowis.store");
    expect(result.text).toContain("https://logements.nowis.store/logements/unit-1");
  });

  it("n'inclut pas l'adresse complete ni le code ISR", () => {
    const result = buildMarketplacePublicText(createRecord());
    expect(result.text).not.toContain("123 Rue Lagace #315");
    expect(result.text).not.toContain("ISR-123");
  });

  it("cree un zip valide avec fichiers textes et photos numerotees", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const isPng = String(url).endsWith(".png");
      const bytes = isPng ? new Uint8Array([137, 80, 78, 71]) : new Uint8Array([255, 216, 255, 224]);
      const contentType = isPng ? "image/png" : "image/jpeg";
      return new Response(bytes, { status: 200, headers: { "content-type": contentType, "content-length": String(bytes.byteLength) } });
    }));

    const text = buildMarketplacePublicText(createRecord()).text;
    const result = await buildMarketplaceZipPackage({
      record: createRecord(),
      orderedPhotoIds: ["p1", "p2"],
      finalText: text,
    });

    const zip = await JSZip.loadAsync(result.zipBuffer);
    const names = Object.keys(zip.files);

    expect(result.fileName).toMatch(/^marketplace-logement-unit-1-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(names).toContain("01-photo-principale.jpg");
    expect(names).toContain("02-photo.png");
    expect(names).toContain("annonce-marketplace.txt");
    expect(names).toContain("lien-public.txt");
    expect(names).toContain("instructions.txt");

    const adText = await zip.file("annonce-marketplace.txt")!.async("string");
    const linkText = await zip.file("lien-public.txt")!.async("string");
    const instructions = await zip.file("instructions.txt")!.async("string");

    expect(adText).toBe(text);
    expect(linkText).toBe("https://logements.nowis.store/logements/unit-1");
    expect(instructions).toContain("1. Ouvrez Facebook Marketplace.");
  });

  it("refuse une URL photo non securisee", async () => {
    const record = createRecord();
    record.property.photos = [{ id: "p3", url: "http://cdn.example.com/insecure.jpg", description: null, sortOrder: 0 }];
    record.selectedPhotos = [{ propertyPhotoId: "p3", channel: "MARKETPLACE", sortOrder: 0, isPrimary: true, excluded: false }];

    await expect(buildMarketplaceZipPackage({
      record,
      orderedPhotoIds: ["p3"],
      finalText: "Texte test",
    })).rejects.toThrow("Aucune photo n'a ete selectionnee.");
  });

  it("continue et signale un echec partiel de photo", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("2.png")) {
        return new Response(new Uint8Array(10), { status: 200, headers: { "content-type": "image/png", "content-length": String(10 * 1024 * 1024) } });
      }
      const bytes = new Uint8Array([255, 216, 255, 224]);
      return new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg", "content-length": String(bytes.byteLength) } });
    }));

    const result = await buildMarketplaceZipPackage({
      record: createRecord(),
      orderedPhotoIds: ["p1", "p2"],
      finalText: "Texte test",
    });

    expect(result.addedPhotoCount).toBe(1);
    expect(result.hasPhotoWarning).toBe(true);
  });
});
