const DEFAULT_PUBLIC_APP_URL = "https://logements.nowis.store";

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_PUBLIC_APP_URL;
}

export function getPublicListingPath(listingId: string) {
  return `/logements/${listingId}`;
}

export function getPublicListingUrl(listingId: string) {
  return new URL(getPublicListingPath(listingId), getPublicAppUrl()).toString();
}
