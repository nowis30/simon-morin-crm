export type PhotoInput = {
  url: string;
  description?: string;
};

// Abstraction prete pour brancher un service de stockage externe plus tard.
export function normalizePhotoLinks(photos: PhotoInput[]) {
  return photos.map((photo, index) => ({
    url: photo.url,
    description: photo.description ?? "",
    sortOrder: index,
  }));
}