"use client";

import { useEffect, useState } from "react";
import { getDefaultWeekSchedule, type WeekSchedule } from "@/lib/visit-availability";

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  googleAccountEmail: string | null;
  calendarId: string;
  lastSyncAt: string | null;
  needsReconnect: boolean;
  timeZone: string;
  configIssues?: string[];
};

type AvailabilitySettings = {
  id: string;
  timeZone: string;
  visitDurationMinutes: number;
  bufferMinutes: number;
  minLeadHours: number;
  maxVisitsPerEvening: number;
  weekSchedule: WeekSchedule;
};

type BlockedPeriod = {
  id: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
};

const DAY_LABELS: Array<{ key: keyof WeekSchedule; label: string }> = [
  { key: "monday", label: "Lundi" },
  { key: "tuesday", label: "Mardi" },
  { key: "wednesday", label: "Mercredi" },
  { key: "thursday", label: "Jeudi" },
  { key: "friday", label: "Vendredi" },
  { key: "saturday", label: "Samedi" },
  { key: "sunday", label: "Dimanche" },
];

export function CalendarSettingsClient() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [settings, setSettings] = useState<AvailabilitySettings | null>(null);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const [statusData, settingsData, blockedData] = await Promise.all([
      fetch("/api/integrations/google/calendar/status").then((r) => r.json()),
      fetch("/api/visits/settings").then((r) => r.json()),
      fetch("/api/visits/blocked-periods").then((r) => r.json()),
    ]);

    setStatus(statusData);
    setSettings({
      ...(settingsData.item ?? {}),
      weekSchedule: (settingsData.item?.weekSchedule ?? getDefaultWeekSchedule()) as WeekSchedule,
    });
    setBlockedPeriods(blockedData.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function disconnect() {
    setError(null);
    setNotice(null);
    const csrf = await fetch("/api/csrf").then((r) => r.json());
    const response = await fetch("/api/integrations/google/calendar/disconnect", {
      method: "POST",
      headers: { "x-csrf-token": csrf.token },
    });

    if (!response.ok) {
      setError("Impossible de deconnecter Google Agenda.");
      return;
    }

    setNotice("Google Agenda deconnecte.");
    await load();
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    const csrf = await fetch("/api/csrf").then((r) => r.json());

    const response = await fetch("/api/visits/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify(settings),
    });

    setSaving(false);

    if (!response.ok) {
      setError("Impossible d'enregistrer les parametres de disponibilite.");
      return;
    }

    setNotice("Parametres enregistres.");
    await load();
  }

  async function addBlockedPeriod(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startsAt = formData.get("startsAt");
    const endsAt = formData.get("endsAt");
    const reason = formData.get("reason");

    const csrf = await fetch("/api/csrf").then((r) => r.json());
    const response = await fetch("/api/visits/blocked-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({
        startsAt: new Date(String(startsAt)).toISOString(),
        endsAt: new Date(String(endsAt)).toISOString(),
        reason: String(reason || ""),
      }),
    });

    if (!response.ok) {
      setError("Impossible d'ajouter la periode bloquee.");
      return;
    }

    setNotice("Periode bloquee ajoutee.");
    event.currentTarget.reset();
    await load();
  }

  async function removeBlockedPeriod(id: string) {
    const csrf = await fetch("/api/csrf").then((r) => r.json());
    const response = await fetch(`/api/visits/blocked-periods/${id}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf.token },
    });

    if (!response.ok) {
      setError("Impossible de supprimer la periode bloquee.");
      return;
    }

    setNotice("Periode bloquee supprimee.");
    await load();
  }

  if (!status || !settings) {
    return <p>Chargement...</p>;
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Parametres Calendrier</h2>
        <p className="text-sm text-emerald-800">Connexion Google Agenda et regles de disponibilite</p>
      </div>

      <div className="card grid gap-3 p-4 text-sm">
        <p>Etat Google: {status.connected ? "Connecte" : "Non connecte"}</p>
        <p>Compte Google: {status.googleAccountEmail || "N/A"}</p>
        <p>Calendrier: {status.calendarId || "primary"}</p>
        <p>Derniere synchronisation: {status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString("fr-CA") : "N/A"}</p>
        {status.configIssues?.length ? (
          <div className="rounded-lg bg-amber-100 p-3 text-amber-900">
            <p className="font-semibold">Configuration manquante:</p>
            {status.configIssues.map((issue) => (
              <p key={issue}>- {issue}</p>
            ))}
          </div>
        ) : null}
        {status.needsReconnect ? <p className="font-semibold text-red-700">Reconnexion Google requise.</p> : null}
        <div className="flex flex-wrap gap-2">
          <a href="/api/integrations/google/calendar/connect" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">Connecter Google Agenda</a>
          <a href="/api/integrations/google/calendar/connect" className="rounded-lg border border-emerald-300 px-4 py-2">Reconnecter</a>
          <button onClick={disconnect} className="rounded-lg border border-emerald-300 px-4 py-2">Deconnecter</button>
        </div>
      </div>

      <form onSubmit={saveSettings} className="card grid gap-3 p-4">
        <h3 className="text-xl font-bold">Regles de disponibilite</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">Fuseau horaire
            <input className="rounded-lg border border-emerald-200 px-3 py-2" value={settings.timeZone} onChange={(e) => setSettings((prev) => prev ? { ...prev, timeZone: e.target.value } : prev)} />
          </label>
          <label className="grid gap-1 text-sm">Duree visite (minutes)
            <input type="number" className="rounded-lg border border-emerald-200 px-3 py-2" value={settings.visitDurationMinutes} onChange={(e) => setSettings((prev) => prev ? { ...prev, visitDurationMinutes: Number(e.target.value) } : prev)} />
          </label>
          <label className="grid gap-1 text-sm">Tampon (minutes)
            <input type="number" className="rounded-lg border border-emerald-200 px-3 py-2" value={settings.bufferMinutes} onChange={(e) => setSettings((prev) => prev ? { ...prev, bufferMinutes: Number(e.target.value) } : prev)} />
          </label>
          <label className="grid gap-1 text-sm">Delai minimal (heures)
            <input type="number" className="rounded-lg border border-emerald-200 px-3 py-2" value={settings.minLeadHours} onChange={(e) => setSettings((prev) => prev ? { ...prev, minLeadHours: Number(e.target.value) } : prev)} />
          </label>
          <label className="grid gap-1 text-sm">Max visites par soiree
            <input type="number" className="rounded-lg border border-emerald-200 px-3 py-2" value={settings.maxVisitsPerEvening} onChange={(e) => setSettings((prev) => prev ? { ...prev, maxVisitsPerEvening: Number(e.target.value) } : prev)} />
          </label>
        </div>

        <div className="grid gap-2">
          {DAY_LABELS.map((day) => {
            const dayRule = settings.weekSchedule[day.key];
            return (
              <div key={day.key} className="grid gap-2 rounded-lg border border-emerald-200 p-3 md:grid-cols-[180px_120px_120px_auto]">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={dayRule.enabled}
                    onChange={(e) =>
                      setSettings((prev) =>
                        prev
                          ? {
                              ...prev,
                              weekSchedule: {
                                ...prev.weekSchedule,
                                [day.key]: { ...prev.weekSchedule[day.key], enabled: e.target.checked },
                              },
                            }
                          : prev,
                      )
                    }
                  />
                  {day.label}
                </label>
                <input
                  type="time"
                  className="rounded-lg border border-emerald-200 px-3 py-2"
                  value={dayRule.start}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            weekSchedule: {
                              ...prev.weekSchedule,
                              [day.key]: { ...prev.weekSchedule[day.key], start: e.target.value },
                            },
                          }
                        : prev,
                    )
                  }
                />
                <input
                  type="time"
                  className="rounded-lg border border-emerald-200 px-3 py-2"
                  value={dayRule.end}
                  onChange={(e) =>
                    setSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            weekSchedule: {
                              ...prev.weekSchedule,
                              [day.key]: { ...prev.weekSchedule[day.key], end: e.target.value },
                            },
                          }
                        : prev,
                    )
                  }
                />
              </div>
            );
          })}
        </div>

        <button className="rounded-lg bg-[var(--accent)] px-4 py-3 text-white" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer les regles"}</button>
      </form>

      <form onSubmit={addBlockedPeriod} className="card grid gap-3 p-4 md:grid-cols-3">
        <input name="startsAt" type="datetime-local" required className="rounded-lg border border-emerald-200 px-3 py-2" />
        <input name="endsAt" type="datetime-local" required className="rounded-lg border border-emerald-200 px-3 py-2" />
        <input name="reason" placeholder="Raison" className="rounded-lg border border-emerald-200 px-3 py-2" />
        <button className="rounded-lg border border-emerald-300 px-4 py-2 md:col-span-3">Ajouter une periode bloquee</button>
      </form>

      <div className="grid gap-2">
        {blockedPeriods.map((item) => (
          <div key={item.id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span>
              {new Date(item.startsAt).toLocaleString("fr-CA")} - {new Date(item.endsAt).toLocaleString("fr-CA")} {item.reason ? `| ${item.reason}` : ""}
            </span>
            <button className="rounded-lg border border-emerald-300 px-3 py-2" onClick={() => removeBlockedPeriod(item.id)}>Supprimer</button>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
    </section>
  );
}
