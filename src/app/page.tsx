import type { Metadata } from "next";
import Link from "next/link";

type CatalogItem = {
  id: string;
  address: string;
  city: string;
  district?: string | null;
  monthlyPrice: number;
  bedrooms: number;
  propertyType: string;
  imageUrl?: string | null;
  photoCount?: number;
  features: string[];
  petsAllowed?: boolean;
  parking?: boolean;
};

export const metadata: Metadata = {
  title: "Logements a louer a Drummondville | Simon Morin",
  description:
    "Decouvrez les logements disponibles a Drummondville et dans les environs. Consultez les photos, les caracteristiques et envoyez votre demande de visite.",
  alternates: {
    canonical: "/",
  },
};

async function getCatalogItems() {
  const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/public/catalog`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [] as CatalogItem[];
  }

  const data = await response.json();
  return (data.items as CatalogItem[]).slice(0, 3);
}

export default async function HomePage() {
  const featuredItems = await getCatalogItems();

  return (
    <main>
      <section className="relative overflow-hidden border-b border-amber-100 bg-gradient-to-br from-amber-100 via-orange-50 to-emerald-100">
        <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:py-20">
          <div className="space-y-6">
            <p className="inline-flex rounded-full border border-amber-300 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Drummondville et les environs
            </p>
            <h1 className="text-4xl font-black leading-tight text-slate-900 md:text-5xl">
              Simon Morin - Agent de location
            </h1>
            <p className="text-xl font-semibold text-slate-800">Trouvez votre prochain logement a Drummondville et dans les environs.</p>
            <p className="max-w-2xl text-base text-slate-700">
              Consultez les logements disponibles, decouvrez les photos et les caracteristiques, puis envoyez directement votre demande de visite.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/logements" className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow transition hover:bg-emerald-500">
                Voir les logements disponibles
              </Link>
              <Link href="/login" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                Connexion administrateur
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">Comment demander une visite</h2>
            <ol className="mt-4 grid gap-3 text-sm text-slate-700">
              <li>1. Ouvrez un logement disponible.</li>
              <li>2. Consultez les photos et caracteristiques.</li>
              <li>3. Remplissez la demande de visite en ligne.</li>
              <li>4. Simon vous contacte pour confirmer disponibilite et horaire.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Selection</p>
            <h2 className="text-3xl font-black text-slate-900">Logements disponibles</h2>
          </div>
          <Link href="/logements" className="text-sm font-semibold text-emerald-700 hover:text-emerald-600">
            Voir tous les logements
          </Link>
        </div>

        {featuredItems.length === 0 ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Aucun logement n'est actuellement disponible. Revenez bientot pour consulter les nouvelles disponibilites.
          </p>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {featuredItems.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="h-44 bg-slate-100">
                  {item.imageUrl ? <img src={item.imageUrl} alt={item.address} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="space-y-2 p-4">
                  <h3 className="text-lg font-bold text-slate-900">{item.address}</h3>
                  <p className="text-sm text-slate-600">{item.city}{item.district ? ` · ${item.district}` : ""}</p>
                  <p className="text-sm text-slate-700">{item.propertyType} · {item.bedrooms} chambre{item.bedrooms > 1 ? "s" : ""}</p>
                  <p className="text-sm text-slate-700">{item.photoCount ? `${item.photoCount} photo${item.photoCount > 1 ? "s" : ""}` : "Aucune photo"}</p>
                  <p className="text-lg font-black text-slate-900">{item.monthlyPrice.toLocaleString("fr-CA")} $ / mois</p>
                  <Link href={`/logements/${item.id}`} className="inline-flex rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                    Voir le logement
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="bg-emerald-900/95 text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:px-6">
          <div className="space-y-3">
            <h2 className="text-2xl font-black">Un accompagnement simple et humain</h2>
            <p className="text-sm text-emerald-100">
              Vous cherchez un logement dans Drummondville ou les environs? Le processus est simple: selection d'un logement, envoi de la demande, puis validation manuelle avec Simon.
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-700 bg-emerald-950/40 p-5">
            <h3 className="text-lg font-bold">Contact</h3>
            <p className="mt-2 text-sm text-emerald-100">Utilisez le formulaire de visite sur chaque fiche logement pour recevoir un retour rapide.</p>
            <Link href="/logements" className="mt-4 inline-flex rounded-full bg-white px-5 py-2 text-sm font-bold text-emerald-900">
              Trouver un logement
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
