import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";

export function isPublicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && c <= 2))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  // Only global unicast IPv6; exclude transition and documentation networks.
  return isIP(address) === 6 && /^[23]/i.test(address) &&
    !/^2002:/i.test(address) && !/^2001:(0*:|0*db8:|0*10:|0*20:)/i.test(address);
}

export async function fetchPublicImage(rawUrl: string, maxBytes: number, timeoutMs: number) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw new Error("URL photo non autorisée");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(hostname, { all: true }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Résolution DNS trop lente")), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Adresse réseau privée refusée");
  }
  const { address, family } = addresses[0];

  return new Promise<Response>((resolve, reject) => {
    const req = request(url, {
      // Pin the validated address. A second DNS response cannot redirect us inward.
      lookup: (_hostname, _options, callback) => callback(null, address, family),
      family,
      agent: false,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: "image/jpeg,image/png,image/webp" },
    }, (res) => {
      if (res.statusCode !== 200 || Number(res.headers["content-length"]) > maxBytes) {
        res.destroy();
        reject(new Error("Image inaccessible ou trop volumineuse"));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("error", reject);
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy(new Error("Image trop volumineuse"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve(new Response(Uint8Array.from(Buffer.concat(chunks)), {
        headers: { "content-type": res.headers["content-type"] || "application/octet-stream" },
      })));
    });
    req.on("error", reject);
    req.end();
  });
}
