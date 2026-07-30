"use client";

import { useState } from "react";

type ContactFormState = {
  name: string;
  phone: string;
  email: string;
  preferredContactMethod: "PHONE" | "EMAIL" | "SMS" | "MESSENGER" | "OTHER";
  message: string;
  consent: boolean;
  honeypot: string;
};

const initialState: ContactFormState = {
  name: "",
  phone: "",
  email: "",
  preferredContactMethod: "PHONE",
  message: "",
  consent: false,
  honeypot: "",
};

export function PublicContactForm() {
  const [form, setForm] = useState<ContactFormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.consent) {
      setError("Le consentement est requis pour envoyer votre message.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/public/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "Impossible d'envoyer votre message pour le moment.");
        return;
      }

      setSuccess("Votre message a ete envoye. Simon communiquera avec vous rapidement.");
      setForm(initialState);
    } catch {
      setError("Une erreur est survenue. Veuillez reessayer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">Formulaire de contact general</h2>
      <input
        className="rounded-lg border border-slate-300 px-3 py-2"
        placeholder="Nom"
        value={form.name}
        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        required
      />
      <input
        className="rounded-lg border border-slate-300 px-3 py-2"
        placeholder="Telephone"
        value={form.phone}
        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        required
      />
      <input
        className="rounded-lg border border-slate-300 px-3 py-2"
        placeholder="Courriel"
        type="email"
        value={form.email}
        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
      />
      <select
        className="rounded-lg border border-slate-300 px-3 py-2"
        value={form.preferredContactMethod}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            preferredContactMethod: event.target.value as ContactFormState["preferredContactMethod"],
          }))
        }
      >
        <option value="PHONE">Telephone</option>
        <option value="EMAIL">Courriel</option>
        <option value="SMS">SMS</option>
        <option value="MESSENGER">Messenger</option>
        <option value="OTHER">Autre</option>
      </select>
      <textarea
        className="min-h-28 rounded-lg border border-slate-300 px-3 py-2"
        placeholder="Message"
        value={form.message}
        onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
        required
      />

      <div className="hidden" aria-hidden>
        <label htmlFor="company">Entreprise</label>
        <input
          id="company"
          tabIndex={-1}
          autoComplete="off"
          value={form.honeypot}
          onChange={(event) => setForm((current) => ({ ...current, honeypot: event.target.value }))}
        />
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(event) => setForm((current) => ({ ...current, consent: event.target.checked }))}
        />
        J'accepte d'etre contacte par Simon Morin concernant ma demande.
      </label>

      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Envoi..." : "Envoyer"}
      </button>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700">{success}</p> : null}
    </form>
  );
}
