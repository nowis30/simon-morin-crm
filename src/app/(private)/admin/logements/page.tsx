"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";

type Property = {
  id: string;
  codeIsr: string;
  address: string;
  city: string;
  district: string | null;
  monthlyPrice: number;
  bedrooms: number;
  status: string;
  petsAllowed: boolean;
  parking: boolean;
  descriptionFr: string;
  descriptionEn: string;
  photos?: { id: string; url: string; description: string | null }[];
  gestionIsrUrl?: string | null;
};

export default function AdminLogementsPage() {
  const [items, setItems] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const response = await fetch("/api/properties", { cache: "no-store" });
    const data = await response.json();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProperty(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const csrf = await fetch("/api/csrf").then((r) => r.json());

    const response = await fetch("/api/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({
        codeIsr: formData.get("codeIsr"),
        address: formData.get("address"),
        city: formData.get("city"),
        district: formData.get("district"),
        monthlyPrice: Number(formData.get("monthlyPrice")),
        propertyType: formData.get("propertyType") || "Appartement",
        bedrooms: Number(formData.get("bedrooms")),
        petsAllowed: formData.get("petsAllowed") === "on",
        petsDetails: formData.get("petsDetails") || "",
        parking: formData.get("parking") === "on",
        inclusions: formData.get("inclusions") || "",
        descriptionFr: formData.get("descriptionFr") || "Description a completer",
        descriptionEn: formData.get("descriptionEn") || "Description to complete",
        photoLinks: [],
        marketingPriority: 3,
        status: "AVAILABLE",
      }),
    });

    setLoading(false);

    if (!response.ok) {
      setError("Impossible de creer le logement");
      return;
    }

    event.currentTarget.reset();
    await load();
  }

  async function generateAds(propertyId: string) {
    const csrf = await fetch("/api/csrf").then((r) => r.json());
    await fetch(`/api/marketing/${propertyId}/generate`, {
      method: "POST",
      headers: { "x-csrf-token": csrf.token },
    });
    alert("Annonces generees.");
  }

  async function importCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await fetch("/api/properties/import", {
      method: "POST",
      body: formData,
    });
    await load();
  }

  async function importGestionIsr(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const url = String(formData.get("url") || "").trim();
    const csrf = await fetch("/api/csrf").then((r) => r.json());

    const response = await fetch("/api/properties/import/gestion-isr", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Import Gestion ISR impossible" }));
      setLoading(false);
      setError(payload.error ?? "Import Gestion ISR impossible");
      return;
    }

    const payload = await response.json();
    setNotice(`Synchronisation terminee: ${payload.added} ajoutes, ${payload.updated} mis a jour, ${payload.removed} retires.`);
    setLoading(false);

    await load();
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Gestion des logements</h2>
          <p className="text-sm text-emerald-800">Gestion, recherche, import/export CSV et synchronisation Gestion ISR</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold" onClick={() => { window.location.href = "/api/properties/export"; }}>
            Exporter CSV
          </button>
        </div>
      </div>

      <section className="card grid gap-3 border-2 border-emerald-400 p-5">
        <div>
          <h3 className="font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold">Mise a jour des logements a louer</h3>
          <p className="text-sm text-emerald-800">Utilise ce bouton pour ajouter les nouveaux logements Gestion ISR et retirer ceux qui ne sont plus affiches.</p>
        </div>
        <form onSubmit={importGestionIsr} className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input name="url" placeholder="URL page logements Gestion ISR (optionnel si GESTION_ISR_LISTINGS_URL est configure)" className="rounded-lg border border-emerald-200 bg-white px-3 py-3" />
          <button className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white" disabled={loading}>
            {loading ? "Synchronisation..." : "Mettre a jour les logements"}
          </button>
        </form>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      </section>

      <form onSubmit={importCsv} className="card flex flex-wrap items-center gap-3 p-4">
        <input type="file" name="file" accept=".csv,text/csv" className="rounded-lg border border-emerald-200 bg-white px-3 py-3" required />
        <button className="rounded-lg border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold">Importer CSV</button>
      </form>

      <form onSubmit={createProperty} className="card grid gap-3 p-4 md:grid-cols-2">
        <input className="rounded-lg border border-emerald-200 px-3 py-3" name="codeIsr" placeholder="Code ISR" required />
        <input className="rounded-lg border border-emerald-200 px-3 py-3" name="address" placeholder="Adresse" required />
        <input className="rounded-lg border border-emerald-200 px-3 py-3" name="city" placeholder="Ville" required />
        <input className="rounded-lg border border-emerald-200 px-3 py-3" name="district" placeholder="Secteur" />
        <input className="rounded-lg border border-emerald-200 px-3 py-3" name="monthlyPrice" placeholder="Prix mensuel" type="number" required />
        <input className="rounded-lg border border-emerald-200 px-3 py-3" name="bedrooms" placeholder="Chambres" type="number" required />
        <input className="rounded-lg border border-emerald-200 px-3 py-3" name="propertyType" placeholder="Type de logement" />
        <input className="rounded-lg border border-emerald-200 px-3 py-3" name="petsDetails" placeholder="Details animaux" />
        <textarea className="rounded-lg border border-emerald-200 px-3 py-3 md:col-span-2" name="descriptionFr" placeholder="Description francaise" />
        <textarea className="rounded-lg border border-emerald-200 px-3 py-3 md:col-span-2" name="descriptionEn" placeholder="Description anglaise" />
        <label className="inline-flex items-center gap-2"><input type="checkbox" name="petsAllowed" /> Animaux acceptes</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" name="parking" /> Stationnement</label>
        {error ? <p className="text-sm text-red-700 md:col-span-2">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-700 md:col-span-2">{notice}</p> : null}
        <button className="rounded-lg bg-[var(--accent)] px-4 py-3 text-white md:col-span-2" disabled={loading}>{loading ? "Enregistrement..." : "Ajouter le logement"}</button>
      </form>

      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="card grid gap-3 p-4">
            {item.photos?.[0] ? (
              <div className="overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50">
                <img src={item.photos[0].url} alt={item.photos[0].description || `${item.address}`} className="h-56 w-full object-cover" />
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-emerald-200 bg-emerald-50 text-sm text-emerald-700">Aucune photo visible pour ce logement</div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold">{item.codeIsr} - {item.address}</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold">{item.status}</span>
            </div>
            <p className="text-sm">{item.city}{item.district ? `, ${item.district}` : ""} - {item.monthlyPrice}$ / mois - {item.bedrooms} ch.</p>
            <div className="flex flex-wrap gap-2">
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.address}, ${item.city}`)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-200 px-3 py-2 text-sm">Ouvrir dans Google Maps</a>
              <button type="button" onClick={() => generateAds(item.id)} className="rounded-lg border border-emerald-200 px-3 py-2 text-sm">Generer annonces</button>
              <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={`/visits?propertyId=${item.id}`}>Planifier une visite</a>
              {item.gestionIsrUrl ? (<a href={item.gestionIsrUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-200 px-3 py-2 text-sm">Ouvrir la fiche ISR</a>) : null}
              <CopyButton text={item.descriptionFr} label="Copier description FR" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
