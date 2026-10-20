"use client";

import { useState } from "react";

export function LogoutButton({ className }: { className: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    try {
      const csrf = await fetch("/api/csrf", { cache: "no-store" });
      if (!csrf.ok) throw new Error("csrf");
      const { token } = await csrf.json();
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "x-csrf-token": token },
      });
      if (!response.ok) throw new Error("logout");
      // A full navigation also discards the client's private router cache.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    } catch {
      setError("Déconnexion impossible. Réessayez.");
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className={className} disabled={pending} onClick={logout}>
        {pending ? "Déconnexion…" : "Déconnexion"}
      </button>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
