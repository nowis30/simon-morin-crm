import { AdLanguage, AdType, AdvertisementStatus, PropertyStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import {
  buildTextDiffLines,
  buildAdvertisementVersionPayload,
  buildFinalReport,
  countModifiedEditableDrafts,
  GENERATOR_VERSION,
  getEditableDraftStatus,
  getAdvertisementKey,
  isAdvertisementIncomplete,
  markEditableDraftsSaved,
  processAdvertisementBatch,
  resetAllEditableDrafts,
  resetEditableDraftByKey,
  toEditableDrafts,
  updateEditableDraftField,
  validateEditableDrafts,
} from "@/lib/marketing";

const baseProperty = {
  id: "property-1",
  codeIsr: "ISR-001",
  address: "123 Rue Test",
  city: "Quebec",
  district: "Limoilou",
  monthlyPrice: 1250,
  propertyType: "Appartement",
  bedrooms: 2,
  availableFrom: new Date("2026-08-01T00:00:00.000Z"),
  petsAllowed: true,
  petsDetails: "Chat accepte",
  parking: true,
  inclusions: "Thermopompe, Balcon",
  descriptionFr: "Description complete du logement avec adresse et details.",
  descriptionEn: "English description pending translation",
  gestionIsrUrl: "https://location.gestion-isr.com/",
  marketplaceUrl: null,
  facebookPostUrl: null,
  marketingPriority: 3,
  lastVerificationDate: null,
  status: PropertyStatus.AVAILABLE,
  archivedAt: null,
  buildingId: null,
  rentalUnitId: null,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-28T12:00:00.000Z"),
  photos: [{ id: "photo-1", propertyId: "property-1", url: "https://example.com/photo.jpg", sortOrder: 0, description: null, createdAt: new Date(), updatedAt: new Date() }],
 };

const completeAd = {
  id: "ad-1",
  propertyId: "property-1",
  type: AdType.MARKETPLACE,
  language: AdLanguage.FR,
  title: "Marketplace FR - ISR-001",
  body: "A louer - 123 Rue Test, Quebec (Limoilou)\nAppartement | 2 chambre(s)\n1250$ / mois\nDisponible: 2026-08-01\nStationnement: Oui\nAnimaux: Chat accepte\nInclusions: Thermopompe, Balcon\n\nDescription complete du logement avec adresse et details.\n\nFiche ISR: https://location.gestion-isr.com/",
  status: AdvertisementStatus.DRAFT,
  generatedAutomatically: true,
  manuallyEdited: false,
  generatedAt: new Date("2026-07-28T13:00:00.000Z"),
  sourcePropertyUpdatedAt: new Date("2026-07-28T12:00:00.000Z"),
  generatorVersion: GENERATOR_VERSION,
  publishedAt: null,
  publicationUrl: null,
  messagesReceived: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
 };

describe("marketing regeneration", () => {
  it("detecte une annonce incomplete", () => {
    const result = isAdvertisementIncomplete(
      {
        ...completeAd,
        body: "Trop court",
        generatedAt: null,
        sourcePropertyUpdatedAt: null,
        generatorVersion: "old",
      },
      baseProperty,
    );

    expect(result.incomplete).toBe(true);
    expect(result.reasons).toContain("texte trop court");
    expect(result.reasons).toContain("ancienne version du generateur");
  });

  it("regenere une annonce automatique existante", async () => {
    const updateAdvertisement = vi.fn(async () => {});
    const createAdvertisement = vi.fn(async () => {});

    const result = await processAdvertisementBatch({
      properties: [baseProperty],
      ads: [completeAd],
      mode: "AUTOMATIC_ONLY",
      offset: 0,
      batchSize: 1,
      handlers: { createAdvertisement, updateAdvertisement },
    });

    expect(updateAdvertisement).toHaveBeenCalled();
    expect(createAdvertisement).toHaveBeenCalledTimes(5);
    expect(result.delta.regeneratedAdvertisements).toBe(6);
  });

  it("protege une annonce modifiee manuellement", async () => {
    const updateAdvertisement = vi.fn(async () => {});
    const createAdvertisement = vi.fn(async () => {});

    const result = await processAdvertisementBatch({
      properties: [baseProperty],
      ads: [{ ...completeAd, manuallyEdited: true }],
      mode: "AUTOMATIC_ONLY",
      offset: 0,
      batchSize: 1,
      handlers: { createAdvertisement, updateAdvertisement },
    });

    expect(updateAdvertisement).not.toHaveBeenCalled();
    expect(result.delta.protectedAdvertisements).toBe(1);
  });

  it("cree un payload d'historique correct", () => {
    const payload = buildAdvertisementVersionPayload(completeAd, "AUTO_REGENERATION");
    expect(payload.type).toBe(AdType.MARKETPLACE);
    expect(payload.language).toBe(AdLanguage.FR);
    expect(payload.changeSource).toBe("AUTO_REGENERATION");
    expect(payload.title).toBe(completeAd.title);
  });

  it("evite les doublons de cle d'annonce", () => {
    const key1 = getAdvertisementKey("property-1", AdType.MARKETPLACE, AdLanguage.FR);
    const key2 = getAdvertisementKey("property-1", AdType.MARKETPLACE, AdLanguage.FR);
    const key3 = getAdvertisementKey("property-1", AdType.MARKETPLACE, AdLanguage.EN);

    expect(key1).toBe(key2);
    expect(key1).not.toBe(key3);
  });

  it("construit le rapport final", () => {
    const report = buildFinalReport({
      totalProperties: 55,
      analyzedAdvertisements: 330,
      regeneratedAdvertisements: 40,
      alreadyUpToDate: 250,
      protectedAdvertisements: 20,
      errors: 2,
      missingAdvertisements: 15,
      skippedAdvertisements: 270,
    });

    expect(report.regeneratedAdvertisements).toBe(40);
    expect(report.totalProperties).toBe(55);
  });

  it("continue le lot apres une erreur", async () => {
    const updateAdvertisement = vi.fn(async (property: { id: string }) => {
      if (property.id === "property-1") {
        throw new Error("boom");
      }
    });
    const createAdvertisement = vi.fn(async () => {});

    const result = await processAdvertisementBatch({
      properties: [baseProperty, { ...baseProperty, id: "property-2", codeIsr: "ISR-002", address: "456 Rue Suite" }],
      ads: [completeAd, { ...completeAd, id: "ad-2", propertyId: "property-2" }],
      mode: "AUTOMATIC_ONLY",
      offset: 0,
      batchSize: 2,
      handlers: { createAdvertisement, updateAdvertisement },
    });

    expect(result.delta.errors).toBeGreaterThan(0);
    expect(result.delta.regeneratedAdvertisements).toBeGreaterThan(0);
  });

  it("detecte un bloc modifie", () => {
    const editable = toEditableDrafts([
      { type: AdType.MARKETPLACE, language: AdLanguage.FR, title: "Titre A", body: "Texte A" },
      { type: AdType.MARKETPLACE, language: AdLanguage.EN, title: "Title B", body: "Body B" },
    ]);

    const changed = updateEditableDraftField(editable, `${AdType.MARKETPLACE}:${AdLanguage.FR}`, "body", "Texte A modifie");
    expect(countModifiedEditableDrafts(changed)).toBe(1);
    expect(getEditableDraftStatus(changed[0])).toBe("MODIFIED");
    expect(getEditableDraftStatus(changed[1])).toBe("AUTO");
  });

  it("reinitialise un seul bloc sans toucher les autres", () => {
    const editable = toEditableDrafts([
      { type: AdType.MARKETPLACE, language: AdLanguage.FR, title: "Titre A", body: "Texte A" },
      { type: AdType.MARKETPLACE, language: AdLanguage.EN, title: "Title B", body: "Body B" },
    ]);

    const changed = updateEditableDraftField(editable, `${AdType.MARKETPLACE}:${AdLanguage.FR}`, "title", "Titre A 2");
    const resetOne = resetEditableDraftByKey(changed, `${AdType.MARKETPLACE}:${AdLanguage.FR}`);

    expect(resetOne[0].title).toBe("Titre A");
    expect(resetOne[1].title).toBe("Title B");
    expect(getEditableDraftStatus(resetOne[0])).toBe("RESET");
    expect(getEditableDraftStatus(resetOne[1])).toBe("AUTO");
  });

  it("reinitialise tous les blocs", () => {
    const editable = toEditableDrafts([
      { type: AdType.MARKETPLACE, language: AdLanguage.FR, title: "Titre A", body: "Texte A" },
      { type: AdType.MARKETPLACE, language: AdLanguage.EN, title: "Title B", body: "Body B" },
    ]);

    const changedA = updateEditableDraftField(editable, `${AdType.MARKETPLACE}:${AdLanguage.FR}`, "body", "Texte A modifie");
    const changedB = updateEditableDraftField(changedA, `${AdType.MARKETPLACE}:${AdLanguage.EN}`, "title", "Title B changed");
    const resetAll = resetAllEditableDrafts(changedB);

    expect(countModifiedEditableDrafts(resetAll)).toBe(0);
    expect(getEditableDraftStatus(resetAll[0])).toBe("RESET");
    expect(getEditableDraftStatus(resetAll[1])).toBe("RESET");
  });

  it("detecte les changements de titre", () => {
    const editable = toEditableDrafts([
      { type: AdType.MARKETPLACE, language: AdLanguage.FR, title: "Titre A", body: "Texte A" },
    ]);
    const changed = updateEditableDraftField(editable, `${AdType.MARKETPLACE}:${AdLanguage.FR}`, "title", "Titre B");
    expect(getEditableDraftStatus(changed[0])).toBe("MODIFIED");
  });

  it("conserve exactement les textes enregistres apres nettoyage des espaces", () => {
    const editable = toEditableDrafts([
      { type: AdType.MARKETPLACE, language: AdLanguage.FR, title: "  Titre A  ", body: "  Texte A\nligne 2  " },
    ]);

    const validation = validateEditableDrafts(editable);
    expect(validation.valid).toBe(true);
    expect(validation.normalizedItems[0].title).toBe("Titre A");
    expect(validation.normalizedItems[0].body).toBe("Texte A\nligne 2");
  });

  it("bloque les titres ou textes vides", () => {
    const editable = toEditableDrafts([
      { type: AdType.MARKETPLACE, language: AdLanguage.FR, title: "   ", body: "Texte A" },
      { type: AdType.MARKETPLACE, language: AdLanguage.EN, title: "Title B", body: "   " },
    ]);

    const validation = validateEditableDrafts(editable);
    expect(validation.valid).toBe(false);
    expect(validation.errors[`${AdType.MARKETPLACE}:${AdLanguage.FR}`].title).toBeTruthy();
    expect(validation.errors[`${AdType.MARKETPLACE}:${AdLanguage.EN}`].body).toBeTruthy();
  });

  it("remet a zero l'etat apres enregistrement reussi", () => {
    const editable = toEditableDrafts([
      { type: AdType.MARKETPLACE, language: AdLanguage.FR, title: "Titre A", body: "Texte A" },
    ]);
    const changed = updateEditableDraftField(editable, `${AdType.MARKETPLACE}:${AdLanguage.FR}`, "body", "Texte A modifie");
    expect(countModifiedEditableDrafts(changed)).toBe(1);

    const saved = markEditableDraftsSaved(changed);
    expect(countModifiedEditableDrafts(saved)).toBe(0);
    expect(getEditableDraftStatus(saved[0])).toBe("AUTO");
  });

  it("genere un diff lisible avec ajouts et suppressions", () => {
    const diff = buildTextDiffLines("Ligne 1\nLigne 2", "Ligne 1\nLigne 2 modifiee\nLigne 3");
    expect(diff.some((line) => line.type === "removed")).toBe(true);
    expect(diff.some((line) => line.type === "added")).toBe(true);
  });
});
