"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  total: number;
};

function toQueryString(params: URLSearchParams) {
  const query = params.toString();
  return query ? `?${query}` : "";
}

function cleanParams(params: URLSearchParams) {
  const next = new URLSearchParams(params);
  for (const [key, value] of next.entries()) {
    if (!value.trim()) {
      next.delete(key);
    }
  }
  return next;
}

export function ListingSearch({ total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const current = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  function updateUrl(nextParams: URLSearchParams) {
    const cleaned = cleanParams(nextParams);
    cleaned.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}${toQueryString(cleaned)}`);
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextParams = new URLSearchParams(current.toString());

    const mappings: Array<[string, string]> = [
      ["q", String(form.get("q") || "")],
      ["city", String(form.get("city") || "")],
      ["district", String(form.get("district") || "")],
      ["bedrooms", String(form.get("bedrooms") || "")],
      ["maxPrice", String(form.get("maxPrice") || "")],
      ["propertyType", String(form.get("propertyType") || "")],
      ["petsAllowed", String(form.get("petsAllowed") || "")],
      ["parking", String(form.get("parking") || "")],
      ["availability", String(form.get("availability") || "")],
      ["sort", String(form.get("sort") || "")],
    ];

    for (const [key, value] of mappings) {
      if (value.trim()) {
        nextParams.set(key, value.trim());
      } else {
        nextParams.delete(key);
      }
    }

    updateUrl(nextParams);
  }

  function resetFilters() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  const activeTags = Array.from(current.entries()).filter(([key]) => !["page", "pageSize"].includes(key));

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <form onSubmit={onSubmit} className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
          <input
            name="q"
            defaultValue={current.get("q") || ""}
            placeholder="Ville, secteur ou mot-cle"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            name="bedrooms"
            type="number"
            min={0}
            max={10}
            defaultValue={current.get("bedrooms") || ""}
            placeholder="Chambres"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            name="maxPrice"
            type="number"
            min={0}
            defaultValue={current.get("maxPrice") || ""}
            placeholder="Prix maximal"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button type="submit" className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">
            Rechercher
          </button>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((value) => !value)}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 md:hidden"
          >
            Afficher les filtres
          </button>
          <p className="text-sm text-slate-300">{total} logements trouves</p>
          <button type="button" onClick={resetFilters} className="text-xs font-semibold text-emerald-400 hover:text-emerald-300">
            Reinitialiser les filtres
          </button>
        </div>

        <div className={`${mobileFiltersOpen ? "grid" : "hidden"} gap-3 md:grid md:grid-cols-3`}>
          <input
            name="city"
            defaultValue={current.get("city") || ""}
            placeholder="Ville"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            name="district"
            defaultValue={current.get("district") || ""}
            placeholder="Secteur"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <input
            name="propertyType"
            defaultValue={current.get("propertyType") || ""}
            placeholder="Type de logement"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <select name="petsAllowed" defaultValue={current.get("petsAllowed") || ""} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="">Animaux: indifferents</option>
            <option value="true">Animaux permis</option>
            <option value="false">Animaux non permis</option>
          </select>
          <select name="parking" defaultValue={current.get("parking") || ""} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="">Stationnement: indifferent</option>
            <option value="true">Avec stationnement</option>
            <option value="false">Sans stationnement</option>
          </select>
          <select name="sort" defaultValue={current.get("sort") || "price_asc"} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="price_asc">Prix croissant</option>
            <option value="price_desc">Prix decroissant</option>
            <option value="bedrooms_desc">Nombre de chambres</option>
            <option value="availability_soon">Disponibilite la plus proche</option>
          </select>
          <select name="availability" defaultValue={current.get("availability") || ""} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <option value="">Disponibilite: indifferente</option>
            <option value="known">Disponibilite connue</option>
          </select>
        </div>

        {activeTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeTags.map(([key, value]) => (
              <span key={`${key}-${value}`} className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                {key}: {value}
              </span>
            ))}
          </div>
        ) : null}

        {isPending ? <p className="text-xs text-slate-400">Chargement des resultats...</p> : null}
      </form>
    </section>
  );
}
