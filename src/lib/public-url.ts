const DEFAULT_PUBLIC_APP_URL = "http://localhost:3000";

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

function isLegacyPublicHost(url: string | undefined) {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes("nowis.store") || hostname.includes("logements.nowis.store");
  } catch {
    return false;
  }
}

export function getPublicAppUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const runtimeCandidates = [
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_URL,
    process.env.PUBLIC_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const candidate of runtimeCandidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (!normalized) continue;
    if (isLegacyPublicHost(normalized)) continue;
    return normalized;
  }

  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeBaseUrl(process.env.RENDER_EXTERNAL_URL) ||
    normalizeBaseUrl(process.env.VERCEL_URL) ||
    normalizeBaseUrl(process.env.PUBLIC_URL) ||
    (process.env.PORT ? normalizeBaseUrl(`http://127.0.0.1:${process.env.PORT}`) : undefined) ||
    DEFAULT_PUBLIC_APP_URL
  );
}

export function getPublicListingPath(listingId: string) {
  return `/logements/${listingId}`;
}

export function getPublicListingUrl(listingId: string) {
  return new URL(getPublicListingPath(listingId), getPublicAppUrl()).toString();
}
