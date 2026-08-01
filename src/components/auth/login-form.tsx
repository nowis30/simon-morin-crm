"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    const csrfResponse = await fetch("/api/csrf");
    const { token } = await csrfResponse.json();

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": token,
      },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    setLoading(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Connexion invalide" }));
      setError(data.error ?? "Connexion invalide");
      return;
    }

    const nextPath = searchParams.get("next") || "/dashboard";
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card grid min-w-0 gap-4 p-4 md:p-6">
      <h2 className="font-[family-name:var(--font-barlow-condensed)] text-xl font-bold leading-tight md:text-2xl">Administration - Simon Morin Agent de location</h2>
      <input name="email" type="email" required placeholder="Courriel" className="min-h-11 rounded-lg border border-emerald-200 bg-white px-4 py-3" />
      <input name="password" type="password" required placeholder="Mot de passe" className="min-h-11 rounded-lg border border-emerald-200 bg-white px-4 py-3" />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button disabled={loading} className="min-h-11 rounded-lg bg-[var(--accent)] px-5 py-3 text-white">
        {loading ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
