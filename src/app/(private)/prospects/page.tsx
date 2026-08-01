"use client";

import { useEffect, useState } from "react";

type Prospect = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  messengerUrl: string | null;
  preferredLanguage: string;
  maxBudget: number | null;
  preferredDistricts: string[];
  bedroomsNeeded: number | null;
  hasPets: boolean;
  needsParking: boolean;
  status: string;
  notes: string | null;
};

export default function ProspectsPage() {
  const [items, setItems] = useState<Prospect[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/prospects", { cache: "no-store" });
    const data = await response.json();
    setItems(data.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createProspect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const csrf = await fetch("/api/csrf").then((r) => r.json());

    const response = await fetch("/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({
        name: formData.get("name"),
        phone: formData.get("phone"),
        email: formData.get("email") || "",
        messengerUrl: formData.get("messengerUrl") || "",
        preferredLanguage: formData.get("preferredLanguage") || "fr",
        maxBudget: formData.get("maxBudget") ? Number(formData.get("maxBudget")) : undefined,
        preferredDistricts: (formData.get("preferredDistricts") as string).split(",").map((x) => x.trim()).filter(Boolean),
        bedroomsNeeded: formData.get("bedroomsNeeded") ? Number(formData.get("bedroomsNeeded")) : undefined,
        hasPets: formData.get("hasPets") === "on",
        needsParking: formData.get("needsParking") === "on",
        notes: formData.get("notes") || "",
        status: "NEW",
      }),
    });

    if (!response.ok) {
      setError("Impossible de creer le prospect");
      return;
    }

    event.currentTarget.reset();
    await load();
  }

  return (
    <section className="grid min-w-0 gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-3xl font-bold md:text-4xl">Prospects</h2>
        <p className="text-sm text-emerald-800">Fiches, suivis et outils mobiles</p>
      </div>

      <form onSubmit={createProspect} className="card grid min-w-0 gap-3 p-4 md:grid-cols-2">
        <input name="name" required placeholder="Nom" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="phone" required placeholder="Telephone" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="email" placeholder="Courriel" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="messengerUrl" placeholder="Lien Messenger" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <select name="preferredLanguage" className="rounded-lg border border-emerald-200 px-3 py-3">
          <option value="fr">Francais</option>
          <option value="en">English</option>
        </select>
        <input name="maxBudget" type="number" placeholder="Budget maximal" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="preferredDistricts" placeholder="Secteurs (separes par virgules)" className="rounded-lg border border-emerald-200 px-3 py-3 md:col-span-2" />
        <input name="bedroomsNeeded" type="number" placeholder="Chambres requises" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <label className="inline-flex items-center gap-2"><input type="checkbox" name="hasPets" /> Animaux</label>
        <label className="inline-flex items-center gap-2"><input type="checkbox" name="needsParking" /> Stationnement requis</label>
        <textarea name="notes" placeholder="Notes" className="rounded-lg border border-emerald-200 px-3 py-3 md:col-span-2" />
        {error ? <p className="text-sm text-red-700 md:col-span-2">{error}</p> : null}
        <button className="min-h-11 rounded-lg bg-[var(--accent)] px-4 py-3 text-white md:col-span-2">Ajouter le prospect</button>
      </form>

      <div className="grid min-w-0 gap-3">
        {items.map((item) => (
          <article key={item.id} className="card grid min-w-0 gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold break-words">{item.name}</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold">{item.status}</span>
            </div>
            <p className="text-sm">Budget: {item.maxBudget ? `${item.maxBudget}$` : "N/A"} | Chambres: {item.bedroomsNeeded ?? "N/A"}</p>
            <p className="text-sm">Secteurs: {item.preferredDistricts.join(", ") || "Aucun"}</p>
            <div className="flex flex-wrap gap-2">
              <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={`tel:${item.phone}`}>Appeler</a>
              <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={`sms:${item.phone}`}>Envoyer un texto</a>
              {item.messengerUrl ? (
                <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={item.messengerUrl} target="_blank" rel="noreferrer">
                  Ouvrir Messenger
                </a>
              ) : null}
              <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={`/matches?prospectId=${item.id}`}>
                Voir correspondances
              </a>
              <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={`/visits?prospectId=${item.id}`}>
                Planifier une visite
              </a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
