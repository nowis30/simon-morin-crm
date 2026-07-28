import { AdLanguage, AdType, type Advertisement, type Property, type PropertyPhoto } from "@prisma/client";

export const GENERATOR_VERSION = "2026-07-28.1";
export const REGENERATION_BATCH_SIZE = 5;

export type MarketingProperty = Property & { photos: PropertyPhoto[] };
export type MarketingAd = Advertisement;

export type GenerationMode = "INCOMPLETE_ONLY" | "AUTOMATIC_ONLY" | "FORCE_ALL";

export type AdDraft = {
  type: AdType;
  language: AdLanguage;
  title: string;
  body: string;
};

export type EditableDraftStatus = "AUTO" | "MODIFIED" | "RESET";

export type EditableDraft = AdDraft & {
  key: string;
  initialTitle: string;
  initialBody: string;
  wasModified: boolean;
};

export type DraftValidationErrors = Record<string, { title?: string; body?: string }>;

export type DraftValidationResult = {
  valid: boolean;
  normalizedItems: AdDraft[];
  errors: DraftValidationErrors;
};

export type TextDiffLineType = "unchanged" | "added" | "removed";

export type TextDiffLine = {
  type: TextDiffLineType;
  value: string;
};

export type AdCompleteness = {
  incomplete: boolean;
  reasons: string[];
};

export type RegenerationPreview = {
  totalProperties: number;
  existingAdvertisements: number;
  replacements: number;
  protectedAdvertisements: number;
  missingAdvertisements: number;
  analyzedAdvertisements: number;
};

export type BatchProgress = {
  processedProperties: number;
  generated: number;
  skipped: number;
  protected: number;
  alreadyUpToDate: number;
  errors: number;
  percent: number;
  nextOffset: number | null;
};

export type FinalReport = {
  totalProperties: number;
  analyzedAdvertisements: number;
  regeneratedAdvertisements: number;
  alreadyUpToDate: number;
  protectedAdvertisements: number;
  errors: number;
  missingAdvertisements: number;
  skippedAdvertisements: number;
};

const AD_SPECS: Array<{ type: AdType; language: AdLanguage; titlePrefix: string }> = [
  { type: AdType.MARKETPLACE, language: AdLanguage.FR, titlePrefix: "Marketplace FR" },
  { type: AdType.MARKETPLACE, language: AdLanguage.EN, titlePrefix: "Marketplace EN" },
  { type: AdType.FACEBOOK_GROUP, language: AdLanguage.FR, titlePrefix: "Groupes FR" },
  { type: AdType.FACEBOOK_GROUP, language: AdLanguage.EN, titlePrefix: "Groupes EN" },
  { type: AdType.MULTI_PROPERTY, language: AdLanguage.BILINGUAL, titlePrefix: "Multi-logements" },
  { type: AdType.MESSENGER_SHORT, language: AdLanguage.BILINGUAL, titlePrefix: "Message court" },
];

export type BatchDelta = {
  analyzedAdvertisements: number;
  regeneratedAdvertisements: number;
  alreadyUpToDate: number;
  protectedAdvertisements: number;
  errors: number;
  missingAdvertisements: number;
  skippedAdvertisements: number;
};

export type BatchProcessorHandlers = {
  createAdvertisement: (property: MarketingProperty, draft: AdDraft) => Promise<void>;
  updateAdvertisement: (property: MarketingProperty, existing: MarketingAd, draft: AdDraft) => Promise<void>;
};

export function buildAdvertisementVersionPayload(ad: Pick<MarketingAd, "type" | "language" | "title" | "body">, changeSource: string) {
  return {
    type: ad.type,
    language: ad.language,
    title: ad.title,
    body: ad.body,
    changeSource,
  };
}

function formatAvailability(property: MarketingProperty) {
  return property.availableFrom ? property.availableFrom.toISOString().split("T")[0] : "Disponibilite a confirmer";
}

function buildEnglishDescription(property: MarketingProperty) {
  if (!property.descriptionEn.includes("pending translation")) {
    return property.descriptionEn;
  }

  return [
    `${property.propertyType}`,
    `${property.bedrooms} bedroom(s)`,
    `Price: ${property.monthlyPrice}$ / month`,
    `Available: ${formatAvailability(property)}`,
    `Parking: ${property.parking ? "Yes" : "No"}`,
    `Pets: ${property.petsAllowed ? property.petsDetails || "Accepted depending on unit policy" : "Not accepted"}`,
    `Inclusions: ${property.inclusions || "To be confirmed"}`,
  ].join("\n");
}

export function buildMarketingTexts(property: MarketingProperty) {
  const available = formatAvailability(property);
  const frAnimals = property.petsAllowed ? property.petsDetails?.trim() || "Acceptes selon les conditions du logement" : "Non acceptes";
  const enAnimals = property.petsAllowed ? property.petsDetails?.trim() || "Accepted depending on the unit policy" : "Not accepted";
  const frParking = property.parking ? "Oui" : "Non";
  const enParking = property.parking ? "Yes" : "No";
  const frInclusions = property.inclusions?.trim() || "A confirmer";
  const enInclusions = property.inclusions?.trim() || "To be confirmed";
  const englishDescription = buildEnglishDescription(property);

  return {
    fr: {
      marketplace:
        `A louer - ${property.address}, ${property.city}${property.district ? ` (${property.district})` : ""}\n` +
        `${property.propertyType} | ${property.bedrooms} chambre(s)\n` +
        `${property.monthlyPrice}$ / mois\n` +
        `Disponible: ${available}\n` +
        `Stationnement: ${frParking}\n` +
        `Animaux: ${frAnimals}\n` +
        `Inclusions: ${frInclusions}\n\n` +
        `${property.descriptionFr}${property.gestionIsrUrl ? `\n\nFiche ISR: ${property.gestionIsrUrl}` : ""}`,
      groups:
        `Nouveau logement disponible a ${property.city}!\n` +
        `${property.address}${property.district ? `, ${property.district}` : ""}\n` +
        `${property.propertyType} | ${property.bedrooms} chambre(s) | ${property.monthlyPrice}$ / mois\n` +
        `Disponible: ${available}\n` +
        `Stationnement: ${frParking} | Animaux: ${frAnimals}\n` +
        `${property.descriptionFr}`,
      messenger:
        `Bonjour! J'ai un logement disponible au ${property.address}, ${property.city}. ` +
        `${property.propertyType}, ${property.bedrooms} chambre(s), ${property.monthlyPrice}$ / mois. ` +
        `Disponible: ${available}. Souhaitez-vous une visite?`,
    },
    en: {
      marketplace:
        `For rent - ${property.address}, ${property.city}${property.district ? ` (${property.district})` : ""}\n` +
        `${property.propertyType} | ${property.bedrooms} bedroom(s)\n` +
        `${property.monthlyPrice}$ / month\n` +
        `Available: ${available}\n` +
        `Parking: ${enParking}\n` +
        `Pets: ${enAnimals}\n` +
        `Inclusions: ${enInclusions}\n\n` +
        `${englishDescription}${property.gestionIsrUrl ? `\n\nISR listing: ${property.gestionIsrUrl}` : ""}`,
      groups:
        `New rental in ${property.city}!\n` +
        `${property.address}${property.district ? `, ${property.district}` : ""}\n` +
        `${property.propertyType} | ${property.bedrooms} bedroom(s) | ${property.monthlyPrice}$ / month\n` +
        `Available: ${available}\n` +
        `Parking: ${enParking} | Pets: ${enAnimals}\n` +
        `${englishDescription}`,
      messenger:
        `Hi! A rental is available at ${property.address}, ${property.city}. ` +
        `${property.propertyType}, ${property.bedrooms} bedroom(s), ${property.monthlyPrice}$ / month. ` +
        `Available: ${available}. Would you like to schedule a visit?`,
    },
  };
}

export function createAdvertisementDrafts(property: MarketingProperty): AdDraft[] {
  const texts = buildMarketingTexts(property);

  return AD_SPECS.map((spec) => {
    if (spec.type === AdType.MARKETPLACE && spec.language === AdLanguage.FR) {
      return { type: spec.type, language: spec.language, title: `${spec.titlePrefix} - ${property.codeIsr}`, body: texts.fr.marketplace };
    }
    if (spec.type === AdType.MARKETPLACE && spec.language === AdLanguage.EN) {
      return { type: spec.type, language: spec.language, title: `${spec.titlePrefix} - ${property.codeIsr}`, body: texts.en.marketplace };
    }
    if (spec.type === AdType.FACEBOOK_GROUP && spec.language === AdLanguage.FR) {
      return { type: spec.type, language: spec.language, title: `${spec.titlePrefix} - ${property.codeIsr}`, body: texts.fr.groups };
    }
    if (spec.type === AdType.FACEBOOK_GROUP && spec.language === AdLanguage.EN) {
      return { type: spec.type, language: spec.language, title: `${spec.titlePrefix} - ${property.codeIsr}`, body: texts.en.groups };
    }
    if (spec.type === AdType.MULTI_PROPERTY) {
      return { type: spec.type, language: spec.language, title: `${spec.titlePrefix} - ${property.city}`, body: `${texts.fr.groups}\n\n---\n\n${texts.en.groups}` };
    }
    return { type: spec.type, language: spec.language, title: `${spec.titlePrefix} - ${property.codeIsr}`, body: `${texts.fr.messenger}\n\n${texts.en.messenger}` };
  });
}

export function getDraftKey(draft: Pick<AdDraft, "type" | "language">) {
  return `${draft.type}:${draft.language}`;
}

export function toEditableDrafts(drafts: AdDraft[]): EditableDraft[] {
  return drafts.map((draft) => ({
    ...draft,
    key: getDraftKey(draft),
    initialTitle: draft.title,
    initialBody: draft.body,
    wasModified: false,
  }));
}

export function isEditableDraftModified(draft: Pick<EditableDraft, "title" | "body" | "initialTitle" | "initialBody">) {
  return draft.title !== draft.initialTitle || draft.body !== draft.initialBody;
}

export function getEditableDraftStatus(draft: EditableDraft): EditableDraftStatus {
  if (isEditableDraftModified(draft)) {
    return "MODIFIED";
  }
  return draft.wasModified ? "RESET" : "AUTO";
}

export function updateEditableDraftField<T extends EditableDraft>(drafts: T[], key: string, field: "title" | "body", value: string): T[] {
  return drafts.map((draft) => {
    if (draft.key !== key) return draft;
    const next = { ...draft, [field]: value };
    if (isEditableDraftModified(next)) {
      next.wasModified = true;
    }
    return next;
  });
}

export function resetEditableDraftByKey<T extends EditableDraft>(drafts: T[], key: string): T[] {
  return drafts.map((draft) => {
    if (draft.key !== key) return draft;
    const wasModified = draft.wasModified || isEditableDraftModified(draft);
    return { ...draft, title: draft.initialTitle, body: draft.initialBody, wasModified };
  });
}

export function resetAllEditableDrafts<T extends EditableDraft>(drafts: T[]): T[] {
  return drafts.map((draft) => {
    const wasModified = draft.wasModified || isEditableDraftModified(draft);
    return { ...draft, title: draft.initialTitle, body: draft.initialBody, wasModified };
  });
}

export function countModifiedEditableDrafts(drafts: EditableDraft[]) {
  return drafts.filter(isEditableDraftModified).length;
}

export function markEditableDraftsSaved<T extends EditableDraft>(drafts: T[]): T[] {
  return drafts.map((draft) => ({
    ...draft,
    initialTitle: draft.title,
    initialBody: draft.body,
    wasModified: false,
  }));
}

export function validateEditableDrafts(drafts: EditableDraft[]): DraftValidationResult {
  const errors: DraftValidationErrors = {};
  const normalizedItems: AdDraft[] = drafts.map((draft) => {
    const normalizedTitle = draft.title.trim();
    const normalizedBody = draft.body.trim();

    if (!normalizedTitle) {
      errors[draft.key] = { ...(errors[draft.key] ?? {}), title: "Le titre est obligatoire." };
    }
    if (!normalizedBody) {
      errors[draft.key] = { ...(errors[draft.key] ?? {}), body: "Le texte est obligatoire." };
    }

    return {
      type: draft.type,
      language: draft.language,
      title: normalizedTitle,
      body: normalizedBody,
    };
  });

  return {
    valid: Object.keys(errors).length === 0,
    normalizedItems,
    errors,
  };
}

export function buildTextDiffLines(original: string, current: string): TextDiffLine[] {
  const originalLines = original.split("\n");
  const currentLines = current.split("\n");
  const rows = originalLines.length;
  const cols = currentLines.length;

  const dp: number[][] = Array.from({ length: rows + 1 }, () => Array.from({ length: cols + 1 }, () => 0));

  for (let i = 1; i <= rows; i += 1) {
    for (let j = 1; j <= cols; j += 1) {
      if (originalLines[i - 1] === currentLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: TextDiffLine[] = [];
  let i = rows;
  let j = cols;

  while (i > 0 && j > 0) {
    if (originalLines[i - 1] === currentLines[j - 1]) {
      diff.unshift({ type: "unchanged", value: originalLines[i - 1] });
      i -= 1;
      j -= 1;
      continue;
    }
    if (dp[i - 1][j] >= dp[i][j - 1]) {
      diff.unshift({ type: "removed", value: originalLines[i - 1] });
      i -= 1;
    } else {
      diff.unshift({ type: "added", value: currentLines[j - 1] });
      j -= 1;
    }
  }

  while (i > 0) {
    diff.unshift({ type: "removed", value: originalLines[i - 1] });
    i -= 1;
  }

  while (j > 0) {
    diff.unshift({ type: "added", value: currentLines[j - 1] });
    j -= 1;
  }

  return diff;
}

export function getAdvertisementKey(propertyId: string, type: AdType, language: AdLanguage) {
  return `${propertyId}:${type}:${language}`;
}

export function isAdvertisementIncomplete(ad: MarketingAd | null | undefined, property: MarketingProperty): AdCompleteness {
  const reasons: string[] = [];
  if (!ad) {
    return { incomplete: true, reasons: ["annonce absente"] };
  }

  const combinedText = `${ad.title}\n${ad.body}`;
  if (ad.body.trim().length < 140) reasons.push("texte trop court");
  if (!combinedText.includes(String(property.monthlyPrice))) reasons.push("prix absent");
  if (!combinedText.toLowerCase().includes(property.address.toLowerCase())) reasons.push("adresse absente");
  if (!combinedText.toLowerCase().includes(property.propertyType.toLowerCase())) reasons.push("type de logement absent");
  if (property.availableFrom) {
    const dateToken = property.availableFrom.toISOString().split("T")[0];
    if (!combinedText.includes(dateToken)) reasons.push("date de disponibilite absente");
  }
  if (!/stationnement|parking/i.test(combinedText)) reasons.push("stationnement absent");
  if (!/animaux|pets/i.test(combinedText)) reasons.push("politique animaux absente");
  if (property.photos.length === 0) reasons.push("aucune photo associee");
  if (property.gestionIsrUrl && !combinedText.includes(property.gestionIsrUrl)) reasons.push("reference ISR absente");
  if (!ad.generatedAt || !ad.sourcePropertyUpdatedAt || ad.sourcePropertyUpdatedAt.getTime() < property.updatedAt.getTime()) {
    reasons.push("annonce plus ancienne que la derniere synchronisation du logement");
  }
  if (ad.generatorVersion !== GENERATOR_VERSION) reasons.push("ancienne version du generateur");

  return { incomplete: reasons.length > 0, reasons };
}

export function shouldProtectManualAd(ad: MarketingAd | null | undefined, mode: GenerationMode) {
  return Boolean(ad?.manuallyEdited && mode !== "FORCE_ALL");
}

export function isAdvertisementUpToDate(ad: MarketingAd | null | undefined, property: MarketingProperty) {
  if (!ad) return false;
  return (
    !ad.manuallyEdited &&
    ad.generatedAutomatically &&
    ad.generatorVersion === GENERATOR_VERSION &&
    !!ad.sourcePropertyUpdatedAt &&
    ad.sourcePropertyUpdatedAt.getTime() >= property.updatedAt.getTime() &&
    !isAdvertisementIncomplete(ad, property).incomplete
  );
}

export function buildRegenerationPreview(properties: MarketingProperty[], ads: MarketingAd[], mode: GenerationMode): RegenerationPreview {
  const adMap = new Map(ads.filter((ad) => ad.propertyId).map((ad) => [getAdvertisementKey(ad.propertyId!, ad.type, ad.language), ad]));
  let replacements = 0;
  let protectedAdvertisements = 0;
  let missingAdvertisements = 0;
  let analyzedAdvertisements = 0;

  for (const property of properties) {
    for (const draft of createAdvertisementDrafts(property)) {
      const key = getAdvertisementKey(property.id, draft.type, draft.language);
      const existing = adMap.get(key);
      analyzedAdvertisements += 1;

      if (!existing) {
        missingAdvertisements += 1;
        continue;
      }

      if (shouldProtectManualAd(existing, mode)) {
        protectedAdvertisements += 1;
        continue;
      }

      const incomplete = isAdvertisementIncomplete(existing, property).incomplete;
      const automatic = existing.generatedAutomatically && !existing.manuallyEdited;
      const mustReplace =
        mode === "FORCE_ALL" ||
        (mode === "AUTOMATIC_ONLY" && automatic) ||
        (mode === "INCOMPLETE_ONLY" && incomplete);

      if (mustReplace) replacements += 1;
    }
  }

  return {
    totalProperties: properties.length,
    existingAdvertisements: ads.length,
    replacements,
    protectedAdvertisements,
    missingAdvertisements,
    analyzedAdvertisements,
  };
}

export function getRegenerationDecision(property: MarketingProperty, existing: MarketingAd | undefined, mode: GenerationMode) {
  if (!existing) {
    return { action: "GENERATE", reason: "missing" } as const;
  }

  if (shouldProtectManualAd(existing, mode)) {
    return { action: "PROTECTED", reason: "manual" } as const;
  }

  if (mode === "FORCE_ALL") {
    return { action: "GENERATE", reason: "force" } as const;
  }

  if (mode === "AUTOMATIC_ONLY") {
    return existing.generatedAutomatically && !existing.manuallyEdited
      ? ({ action: "GENERATE", reason: "automatic" } as const)
      : ({ action: "SKIP", reason: "not-automatic" } as const);
  }

  return isAdvertisementIncomplete(existing, property).incomplete
    ? ({ action: "GENERATE", reason: "incomplete" } as const)
    : ({ action: "SKIP", reason: "up-to-date" } as const);
}

export async function processAdvertisementBatch(args: {
  properties: MarketingProperty[];
  ads: MarketingAd[];
  mode: GenerationMode;
  offset: number;
  batchSize: number;
  handlers: BatchProcessorHandlers;
}) {
  const selectedProperties = args.properties.slice(args.offset, args.offset + args.batchSize);
  const adMap = new Map(args.ads.filter((ad) => ad.propertyId).map((ad) => [getAdvertisementKey(ad.propertyId!, ad.type, ad.language), ad]));
  const delta: BatchDelta = {
    analyzedAdvertisements: 0,
    regeneratedAdvertisements: 0,
    alreadyUpToDate: 0,
    protectedAdvertisements: 0,
    errors: 0,
    missingAdvertisements: 0,
    skippedAdvertisements: 0,
  };

  for (const property of selectedProperties) {
    for (const draft of createAdvertisementDrafts(property)) {
      delta.analyzedAdvertisements += 1;
      const existing = adMap.get(getAdvertisementKey(property.id, draft.type, draft.language));
      const decision = getRegenerationDecision(property, existing, args.mode);

      if (decision.action === "PROTECTED") {
        delta.protectedAdvertisements += 1;
        delta.skippedAdvertisements += 1;
        continue;
      }

      if (decision.action === "SKIP") {
        delta.alreadyUpToDate += 1;
        delta.skippedAdvertisements += 1;
        continue;
      }

      if (!existing) {
        delta.missingAdvertisements += 1;
      }

      try {
        if (existing) {
          await args.handlers.updateAdvertisement(property, existing, draft);
        } else {
          await args.handlers.createAdvertisement(property, draft);
        }
        delta.regeneratedAdvertisements += 1;
      } catch {
        delta.errors += 1;
      }
    }
  }

  const processedProperties = args.offset + selectedProperties.length;

  return {
    processedProperties,
    nextOffset: processedProperties < args.properties.length ? processedProperties : null,
    delta,
  };
}

export function buildFinalReport(input: {
  totalProperties: number;
  analyzedAdvertisements: number;
  regeneratedAdvertisements: number;
  alreadyUpToDate: number;
  protectedAdvertisements: number;
  errors: number;
  missingAdvertisements: number;
  skippedAdvertisements: number;
}): FinalReport {
  return { ...input };
}

export function toCsvReport(report: FinalReport) {
  const rows = [
    ["totalProperties", report.totalProperties],
    ["analyzedAdvertisements", report.analyzedAdvertisements],
    ["regeneratedAdvertisements", report.regeneratedAdvertisements],
    ["alreadyUpToDate", report.alreadyUpToDate],
    ["protectedAdvertisements", report.protectedAdvertisements],
    ["errors", report.errors],
    ["missingAdvertisements", report.missingAdvertisements],
    ["skippedAdvertisements", report.skippedAdvertisements],
  ];
  return ["metric,value", ...rows.map(([metric, value]) => `${metric},${value}`)].join("\n");
}
