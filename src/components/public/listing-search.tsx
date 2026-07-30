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
  const filtersToggleLabel = mobileFiltersOpen ? "Masquer les filtres" : "Plus de filtres";

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <form onSubmit={onSubmit} className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Mot-cle
            <input
              name="q"
              defaultValue={current.get("q") || ""}
              placeholder="Ville, secteur ou mot-cle"
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Chambres
            <input
              name="bedrooms"
              type="number"
              inputMode="numeric"
              min={0}
              max={10}
              defaultValue={current.get("bedrooms") || ""}
              placeholder="Ex: 2"
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Prix maximal
            <input
              name="maxPrice"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={current.get("maxPrice") || ""}
              placeholder="Ex: 1500"
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
          </label>
          <button type="submit" className="min-h-[52px] w-full rounded-full bg-emerald-600 px-4 text-base font-semibold text-white md:w-auto md:px-5">
            Rechercher
          </button>
        </div>

        <div className="grid gap-2 border-t border-slate-100 pt-1 md:grid-cols-[1fr_auto_auto] md:items-center">
          <p className="text-sm font-medium text-slate-700">{total} logements trouves</p>
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((value) => !value)}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700"
          >
            {filtersToggleLabel}
          </button>
          <button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
            Reinitialiser les filtres
          </button>
        </div>

        <div className={`${mobileFiltersOpen ? "grid" : "hidden"} gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid md:grid-cols-3`}>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Ville
            <input
              name="city"
              defaultValue={current.get("city") || ""}
              placeholder="Ex: Drummondville"
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Secteur
            <input
              name="district"
              defaultValue={current.get("district") || ""}
              placeholder="Ex: Saint-Nicephore"
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Type
            <input
              name="propertyType"
              defaultValue={current.get("propertyType") || ""}
              placeholder="Appartement, condo..."
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base"
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Animaux
            <select name="petsAllowed" defaultValue={current.get("petsAllowed") || ""} className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base">
            <option value="">Animaux: indifferents</option>
            <option value="true">Animaux permis</option>
            <option value="false">Animaux non permis</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Stationnement
            <select name="parking" defaultValue={current.get("parking") || ""} className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base">
            <option value="">Stationnement: indifferent</option>
            <option value="true">Avec stationnement</option>
            <option value="false">Sans stationnement</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Disponibilite
            <select name="availability" defaultValue={current.get("availability") || ""} className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base">
              <option value="">Disponibilite: indifferente</option>
              <option value="known">Disponibilite connue</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-800">
            Tri
            <select name="sort" defaultValue={current.get("sort") || "price_asc"} className="min-h-12 rounded-lg border border-slate-300 bg-white px-3 text-base">
            <option value="price_asc">Prix croissant</option>
            <option value="price_desc">Prix decroissant</option>
            <option value="bedrooms_desc">Nombre de chambres</option>
            <option value="availability_soon">Disponibilite la plus proche</option>
            </select>
          </label>
        </div>

        {activeTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeTags.map(([key, value]) => (
              <span key={`${key}-${value}`} className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                {key}: {value}
              </span>
            ))}
          </div>
        ) : null}

        {isPending ? <p className="text-xs text-slate-500">Chargement des resultats...</p> : null}
      </form>
    </section>
  );
}
