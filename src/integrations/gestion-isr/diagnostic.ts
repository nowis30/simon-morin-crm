import type { GestionIsrSupabaseRecord } from "./importer";

export type GestionIsrDiagnostic = {
  recordId: string;
  buildingId: string | null;
  unitId: string | null;
  unitCount: number;
  statuses: string[];
  photoSources: string[];
  possibleLinks: string[];
  missingFields: string[];
};

export function buildGestionIsrDiagnostic(record: GestionIsrSupabaseRecord): GestionIsrDiagnostic {
  const unitIds = (record.units ?? []).map((unit) => unit.id || unit.numero || "").filter(Boolean);
  const statuses = Array.from(new Set((record.units ?? []).map((unit) => String(unit.statut || "").trim()).filter(Boolean)));
  const photoSources = [
    record.main_photo ? "main_photo" : null,
    record.photos?.length ? "photos" : null,
    record.staged_photos?.length ? "staged_photos" : null,
    record.photo_variants?.length ? "photo_variants" : null,
  ].filter(Boolean) as string[];

  return {
    recordId: record.pk || record.id || record.id_app || "unknown",
    buildingId: record.id_app || record.pk || record.id || null,
    unitId: unitIds[0] || null,
    unitCount: unitIds.length,
    statuses,
    photoSources,
    possibleLinks: [record.id_app ? `id_app:${record.id_app}` : null, record.pk ? `pk:${record.pk}` : null, record.id ? `id:${record.id}` : null].filter(Boolean) as string[],
    missingFields: [
      !record.titre ? "titre" : null,
      !record.ville ? "ville" : null,
      !record.secteur ? "secteur" : null,
      !record.description ? "description" : null,
      !record.main_photo ? "main_photo" : null,
    ].filter(Boolean) as string[],
  };
}
