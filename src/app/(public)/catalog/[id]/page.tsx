import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getItem(id: string) {
  return prisma.property.findUnique({
    where: { id },
    include: { photos: { orderBy: { sortOrder: "asc" } } },
  });
}

export default async function PublicCatalogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getItem(id);

  if (!item) {
    return <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">Introuvable</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Détail public</p>
            <h1 className="text-3xl font-semibold">{item.address}</h1>
            <p className="text-slate-400">{item.city}{item.district ? ` · ${item.district}` : ""}</p>
          </div>
          <Link href="/catalog" className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200">Retour au catalogue</Link>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.3fr_0.7fr]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
            {item.photos.length > 0 ? (
              <img src={item.photos[0].url} alt={item.address} className="h-80 w-full object-cover" />
            ) : null}
          </div>
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div>
              <p className="text-sm text-emerald-400">{item.status}</p>
              <p className="text-2xl font-semibold">{item.monthlyPrice.toLocaleString("fr-CA")} $ / mois</p>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>{item.propertyType} · {item.bedrooms} chambre{item.bedrooms > 1 ? "s" : ""}</p>
              <p>{item.petsAllowed ? "Animaux acceptés" : "Animaux non précisés"}</p>
              <p>{item.parking ? "Stationnement inclus" : "Stationnement non précisé"}</p>
            </div>
            <p className="text-sm text-slate-400">{item.descriptionFr}</p>
          </div>
        </div>
      </div>
    </main>
  );
}
