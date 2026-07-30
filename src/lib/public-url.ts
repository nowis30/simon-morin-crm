const DEFAULT_PUBLIC_APP_URL = "https://logements.nowis.store";

function normalizeBaseUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(candidate).toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function getPublicAppUrl() {
  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.RENDER_EXTERNAL_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL) ||
    DEFAULT_PUBLIC_APP_URL
  );
}

export function getPublicListingPath(listingId: string) {
  return `/logements/${listingId}`;
}

export function getPublicListingUrl(listingId: string) {
  return new URL(getPublicListingPath(listingId), getPublicAppUrl()).toString();
}
