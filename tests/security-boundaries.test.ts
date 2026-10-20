import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fetchIsrText, isAllowedIsrUrl } from "@/integrations/gestion-isr/source-policy";
import { fetchGestionIsrListings, fetchGestionIsrRawRecords } from "@/integrations/gestion-isr/importer";
import { parseCsvText, toCsv } from "@/lib/csv";
import { checkRateLimit } from "@/lib/rate-limit";
import { publicContactSubmissionSchema, publicVisitSubmissionSchema } from "@/lib/validators";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("ISR outbound request boundary", () => {
  it.each([
    "http://location.gestion-isr.com",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://169.254.169.254/",
    "https://location.gestion-isr.com.evil.test/",
    "https://user:password@location.gestion-isr.com/",
    "https://location.gestion-isr.com:8443/",
  ])("rejects %s before making either import request", async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(isAllowedIsrUrl(url)).toBe(false);
    await expect(fetchGestionIsrListings(url)).rejects.toThrow("non autorisée");
    await expect(fetchGestionIsrRawRecords(url)).rejects.toThrow("non autorisée");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows only the configured HTTPS origin and refuses redirects", async () => {
    vi.stubEnv("GESTION_ISR_LISTINGS_URL", "https://source.example.com/listings");
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchIsrText("https://source.example.com/listings", {})).toBe("ok");
    expect(fetchMock).toHaveBeenCalledWith("https://source.example.com/listings", expect.objectContaining({
      redirect: "error", cache: "no-store", signal: expect.any(AbortSignal),
    }));
  });

  it("rejects a discovered private data endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      "const SUPABASE_URL = 'https://127.0.0.1'; const SUPABASE_ANON = 'public-key';",
    ));
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchGestionIsrRawRecords("https://location.gestion-isr.com/")).rejects.toThrow("non autorisée");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bounds streamed bodies even without Content-Length", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array(4 * 1024 * 1024 + 1))));
    await expect(fetchIsrText("https://location.gestion-isr.com/", {})).rejects.toThrow("volumineuse");
  });
});

it("neutralizes spreadsheet formulas while preserving ordinary CSV values", () => {
  const values = ["=HYPERLINK(1)", "+SUM(1)", "-2+3", "@SUM(1)", "\t=1", "\r=1", "Alice", "Montréal"];
  const csv = toCsv(values.map((name) => ({ name })));
  const rows = parseCsvText(csv);
  expect(rows.slice(0, 6).every((row) => row.name.startsWith("'"))).toBe(true);
  expect(rows.slice(6).map((row) => row.name)).toEqual(["Alice", "Montréal"]);
});

it("removes the legacy private caches and never intercepts requests", async () => {
  const listeners = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
  const deleteCache = vi.fn().mockResolvedValue(true);
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { addEventListener: (name: string, fn: typeof listeners extends Map<string, infer F> ? F : never) => listeners.set(name, fn), clients: { claim } },
    caches: { keys: async () => ["apis", "others", "next-data"], delete: deleteCache },
  });
  let activation: Promise<unknown> | undefined;
  listeners.get("activate")!({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  expect(deleteCache.mock.calls.map(([name]) => name)).toEqual(["apis", "others", "next-data"]);
  expect(claim).toHaveBeenCalledOnce();
  expect(listeners.has("fetch")).toBe(false);
});

it("expires request counters without accepting unlimited requests in the window", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2040-01-01"));
  expect(checkRateLimit("expiry-regression", 2, 1000).allowed).toBe(true);
  expect(checkRateLimit("expiry-regression", 2, 1000).allowed).toBe(true);
  expect(checkRateLimit("expiry-regression", 2, 1000).allowed).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(checkRateLimit("expiry-regression", 2, 1000).allowed).toBe(true);
});

it("rejects phone values that would normalize to an empty identity", () => {
  expect(publicContactSubmissionSchema.safeParse({ name: "Alice", phone: "abcdefgh", message: "Demande valide", consent: true }).success).toBe(false);
  expect(publicVisitSubmissionSchema.safeParse({
    prospect: { name: "Alice", phone: "abcdefgh" },
    visit: { propertyId: "p1", startsAt: "2030-01-01T10:00:00.000Z" },
  }).success).toBe(false);
});
