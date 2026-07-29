"use client";

import { useState } from "react";

export function VisitRequestForm({ propertyId, rentalUnitId, unavailable }: { propertyId?: string; rentalUnitId?: string; unavailable?: boolean }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", startsAt: "" });
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
            notes: form.notes.trim(),
            hasPets: false,
            needsParking: false,
            preferredDistricts: [],
          },
          visit: {
            propertyId,
            startsAt: new Date(form.startsAt).toISOString(),
            endsAt: new Date(new Date(form.startsAt).getTime() + 30 * 60 * 1000).toISOString(),
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Impossible d’envoyer la demande pour le moment.");
      }

      setSuccess("Votre demande de visite a été envoyée. Simon doit confirmer l’heure avant la confirmation finale.");
      setForm({ name: "", phone: "", email: "", notes: "", startsAt: "" });
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
      <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Nom" />
      <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Téléphone" />
      <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Courriel" />
      <input required type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" />
      <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Informations complémentaires" />
      <button className="w-full rounded-full bg-emerald-500 px-4 py-3 font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Envoi en cours..." : "Envoyer la demande"}
      </button>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
    </form>
  );
}
