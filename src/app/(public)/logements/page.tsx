import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logements disponibles",
  alternates: {
    canonical: "/logements",
  },
};

async function getCatalogItems() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/public/catalog`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return [] as Array<{
      id: string;
      address: string;
      city: string;
      district?: string | null;
      monthlyPrice: number;
      bedrooms: number;
      propertyType: string;
      imageUrl?: string | null;
      photoCount?: number;
      petsAllowed?: boolean;
      parking?: boolean;
      inclusions?: string | null;
      features: string[];
    }>;
  }
  const data = await response.json();
  return data.items as Array<{
    id: string;
    address: string;
    city: string;
    district?: string | null;
    monthlyPrice: number;
    bedrooms: number;
    propertyType: string;
    imageUrl?: string | null;
    photoCount?: number;
    petsAllowed?: boolean;
    parking?: boolean;
    inclusions?: string | null;
    features: string[];
  }>;
}

export default async function PublicListingsPage() {
  const items = await getCatalogItems();

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Logements disponibles</p>
          <h1 className="text-4xl font-semibold">Découvrez les unités disponibles</h1>
          <p className="max-w-2xl text-slate-300">Chaque unité montre les informations utiles au client, sans afficher l’adresse complète avant validation de visite.</p>
        </div>
        {items.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-200">
            Aucun logement n’est actuellement disponible. Revenez bientôt pour consulter les nouvelles disponibilités.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg">
                <div className="h-48 bg-slate-800">{item.imageUrl ? <img src={item.imageUrl} alt={item.address} className="h-full w-full object-cover" /> : null}</div>
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
                    <Link href={`/logements/${item.id}`} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400">Voir le logement</Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
