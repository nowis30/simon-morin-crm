"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PublicListingDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", startsAt: "" });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/public/listings/${params.id}`)
      .then((response) => response.json())
      .then((data) => setItem(data.item));
  }, [params.id]);

  if (!item) {
    return <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">Chargement…</main>;
  }

  async function submitVisit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/public/visits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prospect: {
          name: form.name,
          phone: form.phone,
          email: form.email,
          preferredLanguage: "fr",
          notes: form.notes,
          hasPets: false,
          needsParking: false,
          preferredDistricts: [],
        },
        visit: {
          propertyId: item.id,
          startsAt: form.startsAt,
          endsAt: form.startsAt,
        },
      }),
    });
    if (response.ok) {
      setSubmitted(true);
    }
  }

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
            {submitted ? (
              <div className="mt-6 rounded-xl border border-emerald-700 bg-emerald-950/40 p-4 text-sm text-emerald-300">Votre demande de visite a été envoyée. Simon doit confirmer l’heure avant que le rendez-vous soit officiel.</div>
            ) : (
              <form onSubmit={submitVisit} className="mt-6 space-y-4">
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Nom" />
                <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Téléphone" />
                <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Courriel" />
                <input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
                <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Informations complémentaires" />
                <button className="w-full rounded-full bg-emerald-500 px-4 py-3 font-medium text-slate-950" type="submit">Envoyer la demande</button>
              </form>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
