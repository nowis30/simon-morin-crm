import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { ListingPhotoGallery } from "@/components/public/listing-photo-gallery";
import { VisitRequestForm } from "@/components/public/visit-request-form";
import { MobileVisitCta } from "@/components/public/mobile-visit-cta";
import { dedupeListingPhotos, formatPublicAddress, getPublicFeatures, isPropertyPubliclyAvailable, isRentalUnitPubliclyAvailable, type ListingPhoto } from "@/lib/public-listings";
import { getPublicListingUrl } from "@/lib/public-url";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Fiche logement",
    description:
      "Decouvrez les logements disponibles a Drummondville et dans les environs. Consultez les photos, les caracteristiques et envoyez votre demande de visite.",
    alternates: {
      canonical: `/logements/${id}`,
    },
    openGraph: {
      title: "Logements a louer a Drummondville | Simon Morin",
      description:
        "Decouvrez les logements disponibles a Drummondville et dans les environs. Consultez les photos, les caracteristiques et envoyez votre demande de visite.",
      url: `/logements/${id}`,
      images: [
        {
          url: "/annonce.png",
          width: 864,
          height: 1821,
          alt: "Logements a louer a Drummondville avec Simon Morin",
        },
      ],
      locale: "fr_CA",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Logements a louer a Drummondville | Simon Morin",
      description:
        "Decouvrez les logements disponibles a Drummondville et dans les environs. Consultez les photos, les caracteristiques et envoyez votre demande de visite.",
      images: ["/annonce.png"],
    },
  };
}

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
    const isUnavailable = !isRentalUnitPubliclyAvailable({
      status: rentalUnit.status,
      isPubliclyVisible: rentalUnit.isPubliclyVisible,
      address: rentalUnit.building.address,
      city: rentalUnit.building.city,
      monthlyPrice: rentalUnit.monthlyPrice,
      propertyType: rentalUnit.propertyType,
      bedrooms: rentalUnit.bedrooms,
      description: rentalUnit.publicDescription || rentalUnit.description,
    });
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
      availabilityLabel: isUnavailable ? "Indisponible" : "Disponible",
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

    const priceLabel = `${item.monthlyPrice.toLocaleString("fr-CA")} $ / mois`;
    const canRequestVisit = !item.isUnavailable && Boolean(item.linkedPropertyId);

    return (
      <>
        <main className="min-h-screen overflow-x-hidden bg-transparent px-4 py-4 pb-44 text-slate-900 md:px-6 md:py-10 md:pb-10">
          <div className="mx-auto flex max-w-6xl min-w-0 flex-col gap-4 md:gap-5">
            <Link href="/logements" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700">← Retour aux logements</Link>
            <div className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="min-w-0 space-y-3 md:space-y-4">
                <div className="-mx-4 overflow-hidden bg-slate-950 md:mx-0 md:rounded-2xl md:border md:border-slate-200 md:bg-white">
                  {item.photoCount > 0 ? (
                    <ListingPhotoGallery title={item.address} unitPhotos={item.unitPhotos} buildingPhotos={item.buildingPhotos} />
                  ) : (
                    <div className="flex h-80 items-center justify-center text-sm text-slate-500">Aucune photo disponible pour ce logement.</div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-6">
                  <p className="text-2xl font-black text-slate-900 md:text-3xl">{priceLabel}</p>
                  <h1 className="mt-2 text-xl font-bold text-slate-900 md:text-3xl">{item.address}</h1>
                  <p className="mt-1 text-xs text-slate-700 md:text-sm">{item.city}{item.district ? ` · ${item.district}` : ""}</p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 md:mt-4 md:gap-3">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 md:p-3">
                      <p className="text-xs text-slate-500">Type</p>
                      <p className="text-base font-semibold text-slate-900">{item.propertyType}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 md:p-3">
                      <p className="text-xs text-slate-500">Chambres</p>
                      <p className="text-base font-semibold text-slate-900">{item.bedrooms} chambre{item.bedrooms > 1 ? "s" : ""}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 sm:col-span-2 md:p-3">
                      <p className="text-xs text-slate-500">Disponibilite</p>
                      <p className="text-base font-semibold text-slate-900">{item.availabilityLabel}</p>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-700 md:mt-5">
                    <p className="font-semibold text-slate-900">Caracteristiques essentielles</p>
                    <ul className="mt-2 space-y-1.5 md:space-y-2">
                      {item.features.map((feature: string) => <li key={feature}>• {feature}</li>)}
                    </ul>
                  </div>

                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 md:mt-5">{item.description}</p>
                </div>
              </section>

              <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 md:p-6">
                <h2 className="text-lg font-semibold text-slate-900 md:text-xl">Demander une visite</h2>
                <p className="mt-1.5 text-xs text-slate-600 md:mt-2 md:text-sm">Votre demande sera transmise a Simon pour confirmation manuelle.</p>

                {!item.isUnavailable ? (
                  <a href="#visit-request-form" className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 md:mt-4">
                    Demander une visite
                  </a>
                ) : null}

                <div id="visit-request-form" className="scroll-mt-24">
                  {item.isUnavailable ? (
                    <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:mt-6 md:space-y-4 md:p-4">
                      <p>Ce logement n’est plus disponible — voir les logements semblables.</p>
                      <Link href="/logements" className="inline-flex min-h-11 items-center rounded-full bg-emerald-600 px-4 font-medium text-white">Voir les logements</Link>
                    </div>
                  ) : item.linkedPropertyId ? (
                    <VisitRequestForm propertyId={item.linkedPropertyId} rentalUnitId={item.id} />
                  ) : (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:mt-6 md:p-4">
                      La demande de visite est temporairement desactivee pour cette unite en attente de validation.
                    </div>
                  )}
                </div>

                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getPublicListingUrl(item.id))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  Partager ce logement
                </a>
              </aside>
            </div>
          </div>
        </main>

        {canRequestVisit ? <MobileVisitCta priceLabel={priceLabel} targetId="visit-request-form" /> : null}
      </>
    );
  }

  const property = await prisma.property.findUnique({
    where: { id },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  });

  if (!property || !isPropertyPubliclyAvailable({
    status: property.status,
    address: property.address,
    city: property.city,
    monthlyPrice: property.monthlyPrice,
    propertyType: property.propertyType,
    bedrooms: property.bedrooms,
    description: property.descriptionFr,
  })) {
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
    availabilityLabel: "Disponible",
    features: getPublicFeatures({
      petsAllowed: property.petsAllowed,
      parking: property.parking,
      inclusions: property.inclusions,
    }),
    photos: property.photos.map((photo) => photo.url),
    photoCount: property.photos.length,
    unitPhotos: property.photos.map((photo) => ({ url: photo.url, description: photo.description, category: "UNKNOWN" as const })),
  };

  const fallbackPriceLabel = `${fallbackItem.monthlyPrice.toLocaleString("fr-CA")} $ / mois`;

  return (
    <>
      <main className="min-h-screen overflow-x-hidden bg-transparent px-4 py-4 pb-44 text-slate-900 md:px-6 md:py-10 md:pb-10">
        <div className="mx-auto flex max-w-6xl min-w-0 flex-col gap-4 md:gap-5">
          <Link href="/logements" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-700">← Retour aux logements</Link>
          <div className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="min-w-0 space-y-3 md:space-y-4">
              <div className="-mx-4 overflow-hidden bg-slate-950 md:mx-0 md:rounded-2xl md:border md:border-slate-200 md:bg-white">
                {fallbackItem.photoCount > 0 ? (
                  <ListingPhotoGallery title={fallbackItem.address} unitPhotos={fallbackItem.unitPhotos} />
                ) : (
                  <div className="flex h-80 items-center justify-center text-sm text-slate-500">Aucune photo disponible pour ce logement.</div>
                )}
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-6">
                <p className="text-2xl font-black text-slate-900 md:text-3xl">{fallbackPriceLabel}</p>
                <h1 className="mt-2 text-xl font-bold text-slate-900 md:text-3xl">{fallbackItem.address}</h1>
                <p className="mt-1 text-xs text-slate-700 md:text-sm">{fallbackItem.city}{fallbackItem.district ? ` · ${fallbackItem.district}` : ""}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 md:mt-4 md:gap-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 md:p-3"><p className="text-xs text-slate-500">Type</p><p className="text-base font-semibold text-slate-900">{fallbackItem.propertyType}</p></div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 md:p-3"><p className="text-xs text-slate-500">Chambres</p><p className="text-base font-semibold text-slate-900">{fallbackItem.bedrooms} chambre{fallbackItem.bedrooms > 1 ? "s" : ""}</p></div>
                </div>
                <div className="mt-4 text-sm text-slate-700 md:mt-5">
                  <p className="font-semibold text-slate-900">Caracteristiques essentielles</p>
                  <ul className="mt-2 space-y-1.5 md:space-y-2">
                    {fallbackItem.features.map((feature: string) => <li key={feature}>• {feature}</li>)}
                  </ul>
                </div>
                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 md:mt-5">{fallbackItem.description}</p>
              </div>
            </section>

            <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 md:p-6">
              <h2 className="text-lg font-semibold text-slate-900 md:text-xl">Demander une visite</h2>
              <p className="mt-1.5 text-xs text-slate-600 md:mt-2 md:text-sm">Votre demande sera transmise a Simon pour confirmation manuelle.</p>
              <a href="#visit-request-form" className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 md:mt-4">
                Demander une visite
              </a>
              <div id="visit-request-form" className="scroll-mt-24">
                <VisitRequestForm propertyId={fallbackItem.id} />
              </div>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(getPublicListingUrl(fallbackItem.id))}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-emerald-200 px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                Partager ce logement
              </a>
            </aside>
          </div>
        </div>
      </main>

      <MobileVisitCta priceLabel={fallbackPriceLabel} targetId="visit-request-form" />
    </>
  );
}
