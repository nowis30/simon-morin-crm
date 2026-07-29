"use client";

import { useEffect, useState } from "react";

type MetaStatus = {
  configured: boolean;
  configIssues: string[];
  connected: boolean;
  pageId: string | null;
  pageName: string | null;
  lastSyncAt: string | null;
  appIdConfigured: boolean;
  appSecretConfigured: boolean;
  redirectUri: string | null;
  permissions: string[];
  missingPermissions: string[];
  dryRun: boolean;
  error: string | null;
};

export function MetaSettingsClient() {
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/meta/status");
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Impossible de charger l’état Meta");
      setMeta(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runAction(path: string, method = "GET") {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(path, { method });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Action Meta impossible");
      setMessage(json.message || "Action réalisée");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    await runAction("/api/integrations/meta/test", "POST");
  }

  async function testPermissions() {
    await runAction("/api/integrations/meta/test?mode=permissions", "POST");
  }

  async function simulatePublish() {
    await runAction("/api/integrations/meta/test?mode=publish", "POST");
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Paramètres Facebook</h2>
        <p className="text-sm text-emerald-800">Configuration de la publication Page Facebook et de la connexion Meta.</p>
      </div>

      <div className="card grid gap-3 p-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white" onClick={() => window.location.assign("/api/integrations/meta/connect")}>Connecter Facebook</button>
          <button className="rounded-lg border border-emerald-300 px-4 py-2" onClick={() => runAction("/api/integrations/meta/connect")}>Reconnecter</button>
          <button className="rounded-lg border border-red-300 px-4 py-2" onClick={() => runAction("/api/integrations/meta/disconnect", "POST")}>Déconnecter</button>
          <button className="rounded-lg border border-emerald-300 px-4 py-2" onClick={testConnection}>Tester la connexion</button>
          <button className="rounded-lg border border-emerald-300 px-4 py-2" onClick={testPermissions}>Tester les permissions</button>
          <button className="rounded-lg border border-emerald-300 px-4 py-2" onClick={simulatePublish}>Tester une publication simulée</button>
        </div>

        {loading ? <p>Chargement…</p> : null}
        {meta ? (
          <div className="grid gap-2 rounded-lg border border-emerald-200 p-3">
            <p><strong>État de la configuration:</strong> {meta.configured ? "OK" : "Incomplète"}</p>
            <p><strong>App ID:</strong> {meta.appIdConfigured ? "Configuré" : "Absent"}</p>
            <p><strong>App Secret:</strong> {meta.appSecretConfigured ? "Configuré" : "Absent"}</p>
            <p><strong>URI de redirection:</strong> {meta.redirectUri || "Non définie"}</p>
            <p><strong>Connexion Facebook:</strong> {meta.connected ? "Connectée" : "Non connectée"}</p>
            <p><strong>Page sélectionnée:</strong> {meta.pageName || "Aucune"}</p>
            <p><strong>ID de page:</strong> {meta.pageId ? meta.pageId.replace(/.(?=.{4,}$)/g, "•") : "Aucun"}</p>
            <p><strong>Permissions obtenues:</strong> {meta.permissions.length > 0 ? meta.permissions.join(", ") : "Aucune"}</p>
            <p><strong>Permissions manquantes:</strong> {meta.missingPermissions.length > 0 ? meta.missingPermissions.join(", ") : "Aucune"}</p>
            <p><strong>Dernière vérification:</strong> {meta.lastSyncAt || "Aucune"}</p>
            <p><strong>Mode simulation:</strong> {meta.dryRun ? "Activé" : "Désactivé"}</p>
            {meta.error ? <p className="text-red-700">{meta.error}</p> : null}
          </div>
        ) : null}
      </div>

      {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </section>
  );
}
