import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { ListingSearch } from "@/components/public/listing-search";
import { getPublicAppUrl } from "@/lib/public-url";

export const metadata: Metadata = {
  title: "Logements disponibles",
  alternates: {
    canonical: "/logements",
  },
};

type CatalogResponse = {
  items: Array<{
    id: string;
    address: string;
    city: string;
    district?: string | null;
    monthlyPrice: number;
    bedrooms: number;
    propertyType: string;
    availableFrom?: string | null;
    imageUrl?: string | null;
    photoCount?: number;
    petsAllowed?: boolean;
    parking?: boolean;
    inclusions?: string | null;
    features: string[];
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: Record<string, unknown>;
};

function buildQueryString(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0]);
    } else if (value) {
      params.set(key, value);
    }
  }
  return params.toString();
}

function buildPageUrl(
  searchParams: Record<string, string | string[] | undefined>,
  page: number,
) {
  const next = new URLSearchParams(buildQueryString(searchParams));
  if (page <= 1) {
    next.delete("page");
  } else {
    next.set("page", String(page));
  }
  const query = next.toString();
  return query ? `/logements?${query}` : "/logements";
}

async function getCatalogItems(searchParams: Record<string, string | string[] | undefined>) {
  const query = buildQueryString(searchParams);
  const url = `${getPublicAppUrl()}/api/public/catalog${query ? `?${query}` : ""}`;

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 24,
      totalPages: 1,
      filters: {},
    } as CatalogResponse;
  }

  return response.json() as Promise<CatalogResponse>;
}

export default async function PublicListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const data = await getCatalogItems(query);

  return (
    <main className="min-h-screen bg-transparent px-4 py-5 text-slate-900 md:px-6 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">Logements disponibles</p>
          <h1 className="text-2xl font-black md:text-4xl">Decouvrez les unites disponibles</h1>
          <p className="max-w-2xl text-slate-700">Chaque unite montre les informations utiles au client, sans afficher l'adresse complete avant validation de visite.</p>
        </div>

        <ListingSearch total={data.total} />

        {data.items.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            Aucun logement ne correspond a vos criteres. Modifiez les filtres ou consultez tous les logements disponibles.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="relative aspect-[4/3] bg-slate-100">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.address}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover"
                    />
                  ) : null}
                  <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800">Disponible</div>
                  <div className="absolute right-3 top-3 rounded-full bg-slate-900/85 px-3 py-1 text-xs font-semibold text-white">
                    {item.photoCount ? `${item.photoCount} photos` : "0 photo"}
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-2xl font-black text-slate-900">{item.monthlyPrice.toLocaleString("fr-CA")} $ / mois</p>
                  <p className="text-sm font-medium text-slate-700">{item.bedrooms} chambre{item.bedrooms > 1 ? "s" : ""} · {item.propertyType}</p>
                  <p className="text-sm text-slate-700">{item.city}{item.district ? ` · ${item.district}` : ""}</p>
                  <ul className="space-y-1 text-sm text-slate-600">
                    {item.features.slice(0, 2).map((feature) => <li key={feature}>• {feature}</li>)}
                    {item.inclusions ? <li>• Inclus: {item.inclusions}</li> : null}
                    <li>• Animaux: {item.petsAllowed ? "Permis" : "Non permis"}</li>
                    <li>• Stationnement: {item.parking ? "Oui" : "Non"}</li>
                  </ul>
                  <Link href={`/logements/${item.id}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500">
                    Voir le logement
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:grid-cols-3 sm:items-center">
          <Link
            href={buildPageUrl(query, Math.max(1, data.page - 1))}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 ${data.page <= 1 ? "pointer-events-none text-slate-400" : "text-slate-700 hover:bg-slate-100"}`}
          >
            Precedent
          </Link>
          <p className="text-center text-slate-700">
            Page {data.page} / {Math.max(1, data.totalPages)}
          </p>
          <Link
            href={buildPageUrl(query, Math.min(Math.max(1, data.totalPages), data.page + 1))}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg px-3 ${data.page >= data.totalPages ? "pointer-events-none text-slate-400" : "text-slate-700 hover:bg-slate-100"}`}
          >
            Suivant
          </Link>
        </div>
      </div>
    </main>
  );
}
