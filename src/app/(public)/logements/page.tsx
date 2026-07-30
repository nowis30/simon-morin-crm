import Link from "next/link";
import type { Metadata } from "next";
import { ListingSearch } from "@/components/public/listing-search";

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
  const url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/public/catalog${query ? `?${query}` : ""}`;

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
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 md:px-6 md:py-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Logements disponibles</p>
          <h1 className="text-3xl font-semibold md:text-4xl">Decouvrez les unites disponibles</h1>
          <p className="max-w-2xl text-slate-300">Chaque unite montre les informations utiles au client, sans afficher l'adresse complete avant validation de visite.</p>
        </div>

        <ListingSearch total={data.total} />

        {data.items.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-200">
            Aucun logement ne correspond a vos criteres. Modifiez les filtres ou consultez tous les logements disponibles.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg">
                <div className="h-48 bg-slate-800">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.address} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="space-y-3 p-5">
                  <div>
                    <h2 className="text-xl font-semibold">{item.address}</h2>
                    <p className="text-sm text-slate-400">{item.city}{item.district ? ` · ${item.district}` : ""}</p>
                  </div>
                  <p className="text-sm text-slate-300">{item.propertyType} · {item.bedrooms} chambre{item.bedrooms > 1 ? "s" : ""}</p>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {item.features.slice(0, 2).map((feature) => <li key={feature}>• {feature}</li>)}
                    {item.inclusions ? <li>• Inclus: {item.inclusions}</li> : null}
                    <li>• Animaux: {item.petsAllowed ? "permis" : "non permis"}</li>
                    <li>• Stationnement: {item.parking ? "oui" : "non"}</li>
                  </ul>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">{item.monthlyPrice.toLocaleString("fr-CA")} $ / mois</p>
                      <p className="text-xs text-slate-400">{item.photoCount ? `${item.photoCount} photo${item.photoCount > 1 ? "s" : ""}` : "Aucune photo"}</p>
                    </div>
                    <Link href={`/logements/${item.id}`} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400">
                      Voir le logement
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm">
          <Link
            href={buildPageUrl(query, Math.max(1, data.page - 1))}
            className={`rounded-lg px-3 py-2 ${data.page <= 1 ? "pointer-events-none text-slate-600" : "text-slate-200 hover:bg-slate-800"}`}
          >
            Precedent
          </Link>
          <p>
            Page {data.page} / {Math.max(1, data.totalPages)}
          </p>
          <Link
            href={buildPageUrl(query, Math.min(Math.max(1, data.totalPages), data.page + 1))}
            className={`rounded-lg px-3 py-2 ${data.page >= data.totalPages ? "pointer-events-none text-slate-600" : "text-slate-200 hover:bg-slate-800"}`}
          >
            Suivant
          </Link>
        </div>
      </div>
    </main>
  );
}
