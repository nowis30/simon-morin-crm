import { AdvertisementStatus, PropertyStatus, PublicationChannel, type Advertisement, type Property } from "@prisma/client";

export function getStatusLabelFr(status: AdvertisementStatus) {
  const labels: Record<AdvertisementStatus, string> = {
    DRAFT: "Brouillon",
    READY_FOR_REVIEW: "Pret a reviser",
    CHANGES_REQUESTED: "Modifications demandees",
    APPROVED: "Approuvee",
    PUBLISHING: "Publication en cours",
    PUBLISHED: "Publiee",
    MANUAL_ACTION_REQUIRED: "Action manuelle requise",
    FAILED: "En erreur",
    ARCHIVED: "Archivee",
    RETIRED: "Retiree",
  };
  return labels[status];
}

export function validateApprovalReadiness(args: {
  ad: Pick<Advertisement, "title" | "body" | "generatedAt" | "sourcePropertyUpdatedAt" | "status">;
  property: Pick<Property, "status" | "monthlyPrice" | "updatedAt" | "lastVerificationDate">;
  selectedPhotosCount: number;
  similarPublishedExists: boolean;
  recentPublicationExists: boolean;
}) {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (!args.ad.title?.trim()) blocking.push("Titre vide");
  if (!args.ad.body?.trim()) blocking.push("Texte vide");
  if (!args.property.monthlyPrice) blocking.push("Prix absent");
  if (args.selectedPhotosCount <= 0) blocking.push("Aucune photo selectionnee");
  if (
    args.property.status === PropertyStatus.RENTED ||
    args.property.status === PropertyStatus.REMOVED ||
    args.property.status === PropertyStatus.TO_VERIFY ||
    args.property.status === PropertyStatus.ARCHIVED
  ) {
    blocking.push("Logement non disponible");
  }

  if (args.ad.sourcePropertyUpdatedAt && args.ad.sourcePropertyUpdatedAt.getTime() < args.property.updatedAt.getTime()) {
    warnings.push("Les donnees du logement ont change depuis la generation");
  }

  if (!args.property.lastVerificationDate || Date.now() - args.property.lastVerificationDate.getTime() > 14 * 24 * 60 * 60 * 1000) {
    warnings.push("Logement non verifie recemment");
  }

  if (args.similarPublishedExists) warnings.push("Annonce semblable deja publiee");
  if (args.recentPublicationExists) warnings.push("Publication recente detectee pour le meme canal");

  return {
    canApprove: blocking.length === 0,
    blocking,
    warnings,
  };
}

export function buildApprovalSummary(items: Array<{ channel: PublicationChannel; photos: number; incompleteFields: string[]; warnings: string[] }>, lastPropertyCheck: Date | null) {
  return {
    channels: items.map((item) => item.channel),
    photoCount: items.reduce((sum, item) => sum + item.photos, 0),
    incompleteFields: Array.from(new Set(items.flatMap((item) => item.incompleteFields))),
    warnings: Array.from(new Set(items.flatMap((item) => item.warnings))),
    lastPropertyCheck,
  };
}

export function suggestGroupsForProperty(params: {
  propertyCity: string;
  propertyDistrict?: string | null;
  language: string;
  groups: Array<{
    id: string;
    city?: string | null;
    sectors: string[];
    language?: string | null;
    active: boolean;
    minDelayHours: number;
    lastPublishedAt?: Date | null;
    rules?: string | null;
  }>;
  now?: Date;
}) {
  const now = params.now ?? new Date();

  return params.groups
    .filter((group) => group.active)
    .map((group) => {
      const warnings: string[] = [];
      if (group.city && group.city.toLowerCase() !== params.propertyCity.toLowerCase()) {
        warnings.push("Ville differente");
      }
      if (params.propertyDistrict && group.sectors.length > 0 && !group.sectors.map((s) => s.toLowerCase()).includes(params.propertyDistrict.toLowerCase())) {
        warnings.push("Secteur potentiellement incompatible");
      }
      if (group.language && group.language.toLowerCase() !== params.language.toLowerCase()) {
        warnings.push("Langue differente");
      }
      if (!group.rules) warnings.push("Regles du groupe non enregistrees");
      if (group.lastPublishedAt) {
        const elapsedHours = (now.getTime() - group.lastPublishedAt.getTime()) / 3_600_000;
        if (elapsedHours < group.minDelayHours) warnings.push("Delai minimal entre publications non respecte");
      }
      return { groupId: group.id, warnings, compatible: warnings.length === 0 };
    });
}

export function buildChannelStats(input: Array<{ channel: PublicationChannel; messages: number; prospects: number; visits: number; placements: number; commission: number }>) {
  return input.reduce(
    (acc, row) => {
      const current = acc[row.channel] ?? { messages: 0, prospects: 0, visits: 0, placements: 0, commission: 0 };
      acc[row.channel] = {
        messages: current.messages + row.messages,
        prospects: current.prospects + row.prospects,
        visits: current.visits + row.visits,
        placements: current.placements + row.placements,
        commission: current.commission + row.commission,
      };
      return acc;
    },
    {} as Record<PublicationChannel, { messages: number; prospects: number; visits: number; placements: number; commission: number }>,
  );
}
