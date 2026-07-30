"use client";

import { useState } from "react";

export function VisitRequestForm({ propertyId, rentalUnitId, unavailable }: { propertyId?: string; rentalUnitId?: string; unavailable?: boolean }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    moveInDate: "",
    occupantsCount: "1",
    maxBudget: "",
    bedroomsNeeded: "1",
    hasPets: false,
    needsParking: false,
    availabilityNotes: "",
    notes: "",
    startsAt: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submitVisit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.name.trim() || !form.phone.trim() || !form.startsAt) {
      setError("Veuillez remplir votre nom, téléphone et une date de visite.");
      return;
    }

    if (!/^\+?[0-9\s().-]{7,}$/.test(form.phone.trim())) {
      setError("Veuillez entrer un numéro de téléphone valide.");
      return;
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Veuillez entrer un courriel valide.");
      return;
    }

    if (!propertyId) {
      setError("Cette unité n’est pas encore reliée à une propriété active pour la demande de visite.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/public/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prospect: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim() || "",
            preferredLanguage: "fr",
            moveInDate: form.moveInDate ? new Date(form.moveInDate).toISOString() : undefined,
            occupantsCount: Number(form.occupantsCount),
            maxBudget: form.maxBudget ? Number(form.maxBudget) : undefined,
            bedroomsNeeded: Number(form.bedroomsNeeded),
            hasPets: form.hasPets,
            needsParking: form.needsParking,
            availabilityNotes: form.availabilityNotes.trim(),
            notes: form.notes.trim(),
            preferredDistricts: [],
          },
          visit: {
            propertyId,
            rentalUnitId,
            startsAt: new Date(form.startsAt).toISOString(),
            endsAt: new Date(new Date(form.startsAt).getTime() + 30 * 60 * 1000).toISOString(),
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Impossible d’envoyer la demande pour le moment.");
      }

      setSuccess("Votre demande a été envoyée. Simon communiquera avec vous pour confirmer la disponibilité du logement et l’heure de la visite.");
      setForm({
        name: "",
        phone: "",
        email: "",
        moveInDate: "",
        occupantsCount: "1",
        maxBudget: "",
        bedroomsNeeded: "1",
        hasPets: false,
        needsParking: false,
        availabilityNotes: "",
        notes: "",
        startsAt: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (unavailable) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
        La demande de visite n’est pas disponible pour cette unité pour le moment.
      </div>
    );
  }

  return (
    <form onSubmit={submitVisit} className="mt-6 space-y-4">
      <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Nom complet" />
      <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Telephone" />
      <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Courriel" />
      <input type="date" value={form.moveInDate} onChange={(event) => setForm({ ...form, moveInDate: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="number" min={1} max={12} value={form.occupantsCount} onChange={(event) => setForm({ ...form, occupantsCount: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Nombre d'occupants" />
        <input type="number" min={0} value={form.maxBudget} onChange={(event) => setForm({ ...form, maxBudget: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Budget maximal" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="number" min={0} max={10} value={form.bedroomsNeeded} onChange={(event) => setForm({ ...form, bedroomsNeeded: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Chambres recherchees" />
        <input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.hasPets} onChange={(event) => setForm({ ...form, hasPets: event.target.checked })} /> Presence d'animaux</label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={form.needsParking} onChange={(event) => setForm({ ...form, needsParking: event.target.checked })} /> Besoin de stationnement</label>
      </div>
      <textarea value={form.availabilityNotes} onChange={(event) => setForm({ ...form, availabilityNotes: event.target.value })} className="min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Vos disponibilites pour une visite" />
      <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Message complementaire" />
      <button className="w-full rounded-full bg-emerald-500 px-4 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Envoi en cours..." : "Envoyer la demande"}
      </button>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
    </form>
  );
}
