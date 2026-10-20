const DEFAULT_SOURCE = "https://location.gestion-isr.com";
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

function publicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !host.includes(".") || /^\d+(\.\d+){3}$/.test(host) || host.includes(":") ||
        /\.(localhost|local|internal|lan)$/.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

export function isAllowedIsrUrl(value: string) {
  const url = publicHttpsUrl(value);
  if (!url) return false;
  const configured = publicHttpsUrl(process.env.GESTION_ISR_LISTINGS_URL || "");
  return url.origin === DEFAULT_SOURCE || url.origin === configured?.origin;
}

// Both the HTML import and its discovered data endpoint use this same boundary.
// Redirects must not be able to escape the allowed origin.
export async function fetchIsrText(
  value: string,
  headers: Record<string, string>,
  dataEndpoint = false,
) {
  const url = publicHttpsUrl(value);
  const allowed = dataEndpoint
    ? url && /^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)
    : isAllowedIsrUrl(value);
  if (!allowed) throw new Error("Source ISR non autorisée");

  const response = await fetch(value, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Source ISR inaccessible (${response.status})`);
  if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error("Source ISR trop volumineuse");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("Source ISR trop volumineuse");
      }
      text += decoder.decode(chunk, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
