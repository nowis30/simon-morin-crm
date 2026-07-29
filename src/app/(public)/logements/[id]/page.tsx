import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ListingPhotoGallery } from "@/components/public/listing-photo-gallery";
import { VisitRequestForm } from "@/components/public/visit-request-form";
import { dedupeListingPhotos, formatPublicAddress, getPublicFeatures, getPublicVisibilityForRentalUnit, isPublicPropertyVisible, type ListingPhoto } from "@/lib/public-listings";

export default async function PublicListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rentalUnit = await prisma.rentalUnit.findUnique({
    where: { id },
    include: {
      building: { include: { photos: { orderBy: { sortOrder: "asc" } } } },
      photos: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (rentalUnit) {
    const isUnavailable = !getPublicVisibilityForRentalUnit({ status: rentalUnit.status, isPubliclyVisible: rentalUnit.isPubliclyVisible });
    const linkedProperty = await prisma.property.findFirst({ where: { rentalUnitId: rentalUnit.id } });

    const unitPhotos: ListingPhoto[] = rentalUnit.photos.map((photo) => ({
      url: photo.url,
      description: photo.description,
      category: "UNIT",
    }));
    const buildingPhotos: ListingPhoto[] = rentalUnit.building.photos.map((photo) => ({
      url: photo.url,
      description: photo.description,
      category: "BUILDING",
    }));
    const galleryPhotos = dedupeListingPhotos([...unitPhotos, ...buildingPhotos]);

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
      photos: [rentalUnit.primaryPhotoUrl || galleryPhotos[0]?.url, ...galleryPhotos.map((photo) => photo.url)].filter(Boolean) as string[],
      linkedPropertyId: linkedProperty?.id,
      isUnavailable,
      photoCount: galleryPhotos.length,
      unitPhotos,
      buildingPhotos,
    };

    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-8">
          <Link href="/logements" className="text-sm text-emerald-400">← Retour aux logements</Link>
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="space-y-6">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
                {item.photoCount > 0 ? (
                  <ListingPhotoGallery title={item.address} unitPhotos={item.unitPhotos} buildingPhotos={item.buildingPhotos} />
                ) : (
                  <div className="flex h-80 items-center justify-center text-sm text-slate-400">Aucune photo disponible pour ce logement.</div>
                )}
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
              {item.isUnavailable ? (
                <div className="mt-6 space-y-4 rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-300">
                  <p>Ce logement n’est plus disponible — voir les logements semblables.</p>
                  <Link href="/logements" className="inline-flex rounded-full bg-emerald-500 px-4 py-2 font-medium text-slate-950">Voir les logements</Link>
                </div>
              ) : item.linkedPropertyId ? (
                <VisitRequestForm propertyId={item.linkedPropertyId} rentalUnitId={item.id} />
              ) : (
                <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/70 p-4 text-sm text-slate-300">
                  La demande de visite est temporairement désactivée pour cette unité en attente de validation.
                </div>
              )}
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
    photoCount: property.photos.length,
    unitPhotos: property.photos.map((photo) => ({ url: photo.url, description: photo.description, category: "UNKNOWN" as const })),
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <Link href="/logements" className="text-sm text-emerald-400">← Retour aux logements</Link>
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
              {fallbackItem.photoCount > 0 ? (
                <ListingPhotoGallery title={fallbackItem.address} unitPhotos={fallbackItem.unitPhotos} />
              ) : (
                <div className="flex h-80 items-center justify-center text-sm text-slate-400">Aucune photo disponible pour ce logement.</div>
              )}
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
            <VisitRequestForm propertyId={fallbackItem.id} />
          </aside>
        </div>
      </div>
    </main>
  );
}
