import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPublicAddress, getPublicFeatures, getPublicVisibilityForRentalUnit, isPublicPropertyVisible } from "@/lib/public-listings";

export default async function PublicListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rentalUnit = await prisma.rentalUnit.findUnique({
    where: { id },
    include: { building: true, photos: { orderBy: { sortOrder: "asc" } } },
  });

  if (rentalUnit) {
    if (!getPublicVisibilityForRentalUnit({ status: rentalUnit.status, isPubliclyVisible: rentalUnit.isPubliclyVisible })) {
      notFound();
    }

    const item = {
      id: rentalUnit.id,
      address: formatPublicAddress(rentalUnit.building.address),
      city: rentalUnit.building.city,
      district: rentalUnit.building.district,
      monthlyPrice: rentalUnit.monthlyPrice,
      bedrooms: rentalUnit.bedrooms,
      propertyType: rentalUnit.propertyType,
      description: rentalUnit.publicDescription || rentalUnit.description,
      features: getPublicFeatures({
        petsAllowed: rentalUnit.petsAllowed,
        parking: rentalUnit.parking,
        inclusions: rentalUnit.inclusions,
      }),
      photos: [rentalUnit.primaryPhotoUrl, ...rentalUnit.photos.map((photo) => photo.url)].filter(Boolean) as string[],
    };

    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <Link href="/logements" className="text-sm text-emerald-400">← Retour aux logements</Link>
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-6">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
                {item.photos?.[0] ? <img src={item.photos[0]} alt={item.address} className="h-80 w-full object-cover" /> : null}
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                <h1 className="text-3xl font-semibold">{item.address}</h1>
                <p className="mt-2 text-slate-400">{item.city}{item.district ? ` · ${item.district}` : ""}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div><p className="text-sm text-slate-400">Prix</p><p className="text-xl font-semibold">{item.monthlyPrice.toLocaleString("fr-CA")} $ / mois</p></div>
                  <div><p className="text-sm text-slate-400">Type</p><p className="text-xl font-semibold">{item.propertyType} · {item.bedrooms} chambre{item.bedrooms > 1 ? "s" : ""}</p></div>
                </div>
                <div className="mt-6 text-sm text-slate-300">
                  <p className="font-medium text-white">Caractéristiques</p>
                  <ul className="mt-2 space-y-2">
                    {item.features.map((feature: string) => <li key={feature}>• {feature}</li>)}
                  </ul>
                </div>
                <p className="mt-6 text-slate-300">{item.description}</p>
              </div>
            </section>

            <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h2 className="text-xl font-semibold">Demander une visite</h2>
              <p className="mt-2 text-sm text-slate-400">Votre demande sera transmise à Simon pour confirmation manuelle.</p>
              <form action="/api/public/visits" method="post" className="mt-6 space-y-4">
                <input required name="name" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Nom" />
                <input required name="phone" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Téléphone" />
                <input type="email" name="email" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Courriel" />
                <input required type="datetime-local" name="startsAt" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
                <textarea name="notes" className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Informations complémentaires" />
                <input type="hidden" name="propertyId" value={item.id} />
                <button className="w-full rounded-full bg-emerald-500 px-4 py-3 font-medium text-slate-950" type="submit">Envoyer la demande</button>
              </form>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  const property = await prisma.property.findUnique({
    where: { id },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  });

  if (!property || !isPublicPropertyVisible(property.status)) {
    notFound();
  }

  const fallbackItem = {
    id: property.id,
    address: formatPublicAddress(property.address),
    city: property.city,
    district: property.district,
    monthlyPrice: property.monthlyPrice,
    bedrooms: property.bedrooms,
    propertyType: property.propertyType,
    description: property.descriptionFr,
    features: getPublicFeatures({
      petsAllowed: property.petsAllowed,
      parking: property.parking,
      inclusions: property.inclusions,
    }),
    photos: property.photos.map((photo) => photo.url),
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <Link href="/logements" className="text-sm text-emerald-400">← Retour aux logements</Link>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
              {fallbackItem.photos?.[0] ? <img src={fallbackItem.photos[0]} alt={fallbackItem.address} className="h-80 w-full object-cover" /> : null}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
              <h1 className="text-3xl font-semibold">{fallbackItem.address}</h1>
              <p className="mt-2 text-slate-400">{fallbackItem.city}{fallbackItem.district ? ` · ${fallbackItem.district}` : ""}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div><p className="text-sm text-slate-400">Prix</p><p className="text-xl font-semibold">{fallbackItem.monthlyPrice.toLocaleString("fr-CA")} $ / mois</p></div>
                <div><p className="text-sm text-slate-400">Type</p><p className="text-xl font-semibold">{fallbackItem.propertyType} · {fallbackItem.bedrooms} chambre{fallbackItem.bedrooms > 1 ? "s" : ""}</p></div>
              </div>
              <div className="mt-6 text-sm text-slate-300">
                <p className="font-medium text-white">Caractéristiques</p>
                <ul className="mt-2 space-y-2">
                  {fallbackItem.features.map((feature: string) => <li key={feature}>• {feature}</li>)}
                </ul>
              </div>
              <p className="mt-6 text-slate-300">{fallbackItem.description}</p>
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Demander une visite</h2>
            <p className="mt-2 text-sm text-slate-400">Votre demande sera transmise à Simon pour confirmation manuelle.</p>
            <form action="/api/public/visits" method="post" className="mt-6 space-y-4">
              <input required name="name" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Nom" />
              <input required name="phone" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Téléphone" />
              <input type="email" name="email" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Courriel" />
              <input required type="datetime-local" name="startsAt" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
              <textarea name="notes" className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Informations complémentaires" />
              <input type="hidden" name="propertyId" value={fallbackItem.id} />
              <button className="w-full rounded-full bg-emerald-500 px-4 py-3 font-medium text-slate-950" type="submit">Envoyer la demande</button>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}
