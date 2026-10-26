"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SetupForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
    const csrfResponse = await fetch("/api/csrf");
    const { token } = await csrfResponse.json();

    const response = await fetch("/api/setup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": token,
        "x-setup-token": String(formData.get("setupToken") ?? ""),
      },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Erreur de configuration" }));
      setError(data.error ?? "Erreur de configuration");
      return;
    }

    router.push("/dashboard");
    router.refresh();
    } catch {
      setError("Connexion interrompue. Reessayez la configuration.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-4 p-6">
      <h2 className="font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold">Premiere configuration</h2>
      <label className="grid gap-2 text-sm">
        Code d’initialisation fourni par le responsable
        <input name="setupToken" type="password" autoComplete="off" required minLength={32} maxLength={512} className="rounded-lg border border-emerald-200 bg-white px-4 py-3" />
      </label>
      <input name="name" required placeholder="Nom" className="rounded-lg border border-emerald-200 bg-white px-4 py-3" />
      <input name="email" type="email" required placeholder="Courriel" className="rounded-lg border border-emerald-200 bg-white px-4 py-3" />
      <input
        name="password"
        type="password"
        required
        minLength={12}
        placeholder="Mot de passe"
        className="rounded-lg border border-emerald-200 bg-white px-4 py-3"
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="rounded-lg bg-[var(--accent)] px-5 py-3 text-white">
        {loading ? "Creation..." : "Creer l'administrateur"}
      </button>
    </form>
  );
}
