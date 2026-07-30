import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublicAppUrl } from "@/lib/public-url";

const OFFICIAL_PUBLIC_EMAIL = "simonmorin@nowis.store";
const OFFICIAL_PUBLIC_PHONE_DISPLAY = "819-388-3407";
const OFFICIAL_PUBLIC_PHONE_TECHNICAL = "+18193883407";

async function getCatalogItems() {
  const response = await fetch(`${getPublicAppUrl()}/api/public/catalog`, {
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
    }>;
  }

  const data = await response.json();
  return (data.items as Array<{
    id: string;
    address: string;
    city: string;
    district?: string | null;
    monthlyPrice: number;
    bedrooms: number;
    propertyType: string;
    imageUrl?: string | null;
    photoCount?: number;
  }>).slice(0, 3);
}

export const metadata: Metadata = {
  title: "Logements a louer a Drummondville | Simon Morin",
  description:
    "Decouvrez les logements disponibles a Drummondville et dans les environs. Consultez les photos, les caracteristiques et envoyez votre demande de visite.",
  alternates: {
    canonical: "/",
  },
};

export default async function HomePage() {
  const featuredItems = await getCatalogItems();

  return (
    <>
      <section className="relative overflow-hidden border-b border-amber-100 bg-gradient-to-br from-amber-100 via-orange-50 to-emerald-100">
        <div className="pointer-events-none absolute -right-20 -top-16 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-12">
          <div className="space-y-4 md:max-w-3xl md:space-y-5">
            <p className="inline-flex rounded-full border border-amber-300 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
              Drummondville et les environs
            </p>
            <h1 className="text-3xl font-black leading-tight text-slate-900 md:text-5xl">
              <span className="md:hidden">Trouvez votre prochain logement</span>
              <span className="hidden md:inline">Simon Morin - Votre agent de location a Drummondville</span>
            </h1>
            <p className="text-base font-semibold text-slate-800 md:text-xl">Logements disponibles a Drummondville et dans les environs.</p>
            <p className="max-w-2xl text-sm text-slate-700 md:text-base">
              Consultez les photos, filtrez les resultats et envoyez votre demande de visite.
            </p>

            <form action="/logements" method="get" className="grid gap-3 rounded-2xl border border-amber-200 bg-white/90 p-4 md:grid-cols-3 md:items-end">
              <label className="grid gap-1 text-sm font-medium text-slate-800">
                Ville ou secteur
                <input name="city" placeholder="Ex: Drummondville" className="min-h-12 rounded-lg border border-slate-300 px-3 text-base" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-800">
                Chambres
                <input name="bedrooms" type="number" inputMode="numeric" min={0} placeholder="Ex: 2" className="min-h-12 rounded-lg border border-slate-300 px-3 text-base" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-800">
                Prix maximal
                <input name="maxPrice" type="number" inputMode="numeric" min={0} placeholder="Ex: 1500" className="min-h-12 rounded-lg border border-slate-300 px-3 text-base" />
              </label>
              <button type="submit" className="min-h-[52px] w-full rounded-full bg-emerald-600 px-6 text-base font-bold text-white shadow transition hover:bg-emerald-500 md:col-span-3">
                Rechercher
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <Link href="/logements" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-emerald-600 px-6 text-base font-bold text-white shadow transition hover:bg-emerald-500 sm:w-auto">
                Voir les logements
              </Link>
              <Link href="/login" className="text-xs font-semibold text-slate-600 hover:text-slate-900">
                Connexion administrateur
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Selection</p>
            <h2 className="text-2xl font-black text-slate-900 md:text-3xl">Logements disponibles</h2>
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredItems.map((item) => (
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
                <div className="space-y-2 p-4">
                  <p className="text-2xl font-black text-slate-900">{item.monthlyPrice.toLocaleString("fr-CA")} $ / mois</p>
                  <p className="text-sm font-medium text-slate-700">{item.bedrooms} chambre{item.bedrooms > 1 ? "s" : ""} · {item.propertyType}</p>
                  <h3 className="text-base font-bold text-slate-900">{item.city}{item.district ? ` · ${item.district}` : ""}</h3>
                  <p className="text-sm text-slate-600">Secteur: {item.address}</p>
                  <Link href={`/logements/${item.id}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                    Voir le logement
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-2 md:px-6 md:py-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Comment demander une visite</h2>
          <ol className="mt-4 grid gap-3 text-sm text-slate-700">
            <li>1. Ouvrez un logement disponible.</li>
            <li>2. Consultez les photos et caracteristiques.</li>
            <li>3. Remplissez la demande de visite en ligne.</li>
            <li>4. Simon vous contacte pour confirmer disponibilite et horaire.</li>
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-8">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-slate-900 md:p-5">
          <p className="text-base font-bold">Une question concernant un logement?</p>
          <p className="mt-1 text-sm text-slate-700">
            Communiquez directement avec Simon Morin au 819-388-3407 ou a simonmorin@nowis.store.
          </p>
          <div className="mt-3 grid gap-3 sm:flex sm:flex-wrap">
            <a href={`tel:${OFFICIAL_PUBLIC_PHONE_TECHNICAL}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 sm:w-auto">
              {OFFICIAL_PUBLIC_PHONE_DISPLAY}
            </a>
            <a href={`mailto:${OFFICIAL_PUBLIC_EMAIL}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-400 px-4 text-sm font-semibold text-slate-900 hover:bg-white sm:w-auto">
              Envoyer un courriel
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-4 md:px-6 md:pb-8">
        <div className="rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm md:grid md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-6 md:p-5">
          <div className="relative mx-auto aspect-[864/1821] w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white md:max-w-none">
            <Image
              src="/annonce.png"
              alt="Logements a louer a Drummondville avec Simon Morin"
              fill
              className="object-contain"
              sizes="(max-width: 768px) 92vw, 45vw"
              loading="lazy"
            />
          </div>
          <div className="mt-4 space-y-2 md:mt-0">
            <h2 className="text-lg font-bold text-slate-900">Accompagnement humain et rapide</h2>
            <p className="text-sm text-slate-700">
              Chaque demande est traitee directement par Simon pour offrir une prise de rendez-vous simple et rapide.
            </p>
            <a
              href={`sms:${OFFICIAL_PUBLIC_PHONE_TECHNICAL}?body=Bonjour%20Simon%2C%20je%20souhaite%20des%20informations%20sur%20un%20logement.`}
              className="inline-flex min-h-11 items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Envoyer un SMS
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
