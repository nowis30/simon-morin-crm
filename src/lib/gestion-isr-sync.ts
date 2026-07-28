import { PropertyStatus, type Property, type PropertyPhoto } from "@prisma/client";

export type SyncSnapshotProperty = Pick<Property, "id" | "codeIsr" | "address" | "status" | "gestionIsrUrl"> & {
  photos: Pick<PropertyPhoto, "url">[];
};

export type SyncSnapshot = {
  codes: string[];
  statusByCode: Record<string, string>;
  addressByCode: Record<string, string>;
  photoSignatureByCode: Record<string, string>;
};

export type SyncComparisonReport = {
  importedProperties: number;
  availableProperties: number;
  rentedProperties: number;
  removedProperties: number;
  toVerifyProperties: number;
  missingNow: string[];
  newProperties: string[];
  changedAddresses: string[];
  changedPhotos: string[];
};

export function buildSyncSnapshot(properties: SyncSnapshotProperty[]): SyncSnapshot {
  return {
    codes: properties.map((property) => property.codeIsr).sort(),
    statusByCode: Object.fromEntries(properties.map((property) => [property.codeIsr, property.status])),
    addressByCode: Object.fromEntries(properties.map((property) => [property.codeIsr, property.address])),
    photoSignatureByCode: Object.fromEntries(
      properties.map((property) => [property.codeIsr, property.photos.map((photo) => photo.url).join("|")]),
    ),
  };
}

export function getCodesToFlagAsVerify(existingCodes: string[], currentCodes: string[]) {
  const current = new Set(currentCodes);
  return existingCodes.filter((code) => !current.has(code));
}

export function buildSyncComparisonReport(current: SyncSnapshotProperty[], previousSnapshot?: SyncSnapshot | null): SyncComparisonReport {
  const currentSnapshot = buildSyncSnapshot(current);
  const previousCodes = previousSnapshot?.codes ?? [];
  const currentCodes = currentSnapshot.codes;
  const previousSet = new Set(previousCodes);
  const currentSet = new Set(currentCodes);

  return {
    importedProperties: current.length,
    availableProperties: current.filter((property) => property.status === PropertyStatus.AVAILABLE).length,
    rentedProperties: current.filter((property) => property.status === PropertyStatus.RENTED).length,
    removedProperties: current.filter((property) => property.status === PropertyStatus.REMOVED).length,
    toVerifyProperties: current.filter((property) => property.status === PropertyStatus.TO_VERIFY).length,
    missingNow: previousCodes.filter((code) => !currentSet.has(code)),
    newProperties: currentCodes.filter((code) => !previousSet.has(code)),
    changedAddresses: previousCodes.filter(
      (code) => currentSet.has(code) && previousSnapshot?.addressByCode[code] !== currentSnapshot.addressByCode[code],
    ),
    changedPhotos: previousCodes.filter(
      (code) => currentSet.has(code) && previousSnapshot?.photoSignatureByCode[code] !== currentSnapshot.photoSignatureByCode[code],
    ),
  };
}
