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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof form, string>>>({});

  async function submitVisit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const nextErrors: Partial<Record<keyof typeof form, string>> = {};

    if (!form.name.trim()) {
      nextErrors.name = "Le nom est requis.";
    }

    if (!form.phone.trim()) {
      nextErrors.phone = "Le telephone est requis.";
    } else if (!/^\+?[0-9\s().-]{7,}$/.test(form.phone.trim())) {
      nextErrors.phone = "Veuillez entrer un numero de telephone valide.";
    }

    if (!form.startsAt) {
      nextErrors.startsAt = "Veuillez choisir une date de visite.";
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Veuillez entrer un courriel valide.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setError("Veuillez corriger les champs indiques.");
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
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        La demande de visite n’est pas disponible pour cette unité pour le moment.
      </div>
    );
  }

  return (
    <form id="visit-request-form" onSubmit={submitVisit} className="mt-5 space-y-4">
      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Nom complet
        <input
          required
          autoComplete="name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
          placeholder="Votre nom"
        />
        {fieldErrors.name ? <span className="text-xs text-rose-600">{fieldErrors.name}</span> : null}
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Telephone
        <input
          required
          autoComplete="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
          className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
          placeholder="819-388-3407"
        />
        {fieldErrors.phone ? <span className="text-xs text-rose-600">{fieldErrors.phone}</span> : null}
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Courriel
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
          placeholder="vous@exemple.com"
        />
        {fieldErrors.email ? <span className="text-xs text-rose-600">{fieldErrors.email}</span> : null}
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Date d'emmenagement souhaitee
        <input
          type="date"
          autoComplete="off"
          value={form.moveInDate}
          onChange={(event) => setForm({ ...form, moveInDate: event.target.value })}
          className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-800">
          Nombre d'occupants
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            value={form.occupantsCount}
            onChange={(event) => setForm({ ...form, occupantsCount: event.target.value })}
            className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            placeholder="1"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-800">
          Budget maximal
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={form.maxBudget}
            onChange={(event) => setForm({ ...form, maxBudget: event.target.value })}
            className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            placeholder="1500"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-800">
          Chambres recherchees
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={10}
            value={form.bedroomsNeeded}
            onChange={(event) => setForm({ ...form, bedroomsNeeded: event.target.value })}
            className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
            placeholder="1"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-800">
          Date et heure souhaitees
          <input
            required
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
            className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base"
          />
          {fieldErrors.startsAt ? <span className="text-xs text-rose-600">{fieldErrors.startsAt}</span> : null}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"><input type="checkbox" checked={form.hasPets} onChange={(event) => setForm({ ...form, hasPets: event.target.checked })} /> Presence d'animaux</label>
        <label className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"><input type="checkbox" checked={form.needsParking} onChange={(event) => setForm({ ...form, needsParking: event.target.checked })} /> Besoin de stationnement</label>
      </div>

      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Vos disponibilites pour une visite
        <textarea value={form.availabilityNotes} onChange={(event) => setForm({ ...form, availabilityNotes: event.target.value })} className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base" placeholder="Ex: mardi soir, mercredi matin" />
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-800">
        Message complementaire
        <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base" placeholder="Vos questions" />
      </label>

      <button className="min-h-[52px] w-full rounded-full bg-emerald-600 px-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Envoi en cours..." : "Envoyer la demande"}
      </button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
    </form>
  );
}
