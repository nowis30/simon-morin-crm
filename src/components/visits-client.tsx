"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Visit = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string | null;
  internalNotes?: string | null;
  googleEventHtmlLink?: string | null;
  prospect: { id: string; name: string; phone: string; email: string | null; preferredLanguage: string; messengerUrl?: string | null };
  property: { id: string; codeIsr: string; address: string; city?: string; district?: string | null };
};

type Prospect = { id: string; name: string; phone: string; email: string | null; preferredLanguage: string; messengerUrl?: string | null };
type Property = { id: string; codeIsr: string; address: string; city?: string; district?: string | null };
type Slot = { startsAt: string; endsAt: string; timeZone: string };

type VisitsView = "TODAY" | "WEEK" | "PENDING" | "CONFIRMED" | "COMPLETED";

export function VisitsClient({ initialView = "TODAY" }: { initialView?: VisitsView }) {
  const searchParams = useSearchParams();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; configured: boolean; needsReconnect: boolean } | null>(null);
  const [view, setView] = useState<VisitsView>(initialView);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedProspectId, setSelectedProspectId] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");

  async function load() {
    const [visitsData, prospectsData, propertiesData, googleStatusData] = await Promise.all([
      fetch("/api/visits").then((response) => response.json()),
      fetch("/api/prospects").then((response) => response.json()),
      fetch("/api/properties").then((response) => response.json()),
      fetch("/api/integrations/google/calendar/status").then((response) => response.json()),
    ]);

    setVisits(visitsData.items ?? []);
    setProspects((prospectsData.items ?? []).map((item: Prospect) => ({ id: item.id, name: item.name, phone: item.phone, email: item.email, preferredLanguage: item.preferredLanguage, messengerUrl: item.messengerUrl })));
    setProperties((propertiesData.items ?? []).map((item: Property) => ({ id: item.id, codeIsr: item.codeIsr, address: item.address, city: item.city, district: item.district })));
    setGoogleStatus({
      connected: Boolean(googleStatusData.connected),
      configured: Boolean(googleStatusData.configured),
      needsReconnect: Boolean(googleStatusData.needsReconnect),
    });
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const prospectId = searchParams.get("prospectId") || "";
    const propertyId = searchParams.get("propertyId") || "";
    setSelectedProspectId(prospectId);
    setSelectedPropertyId(propertyId);
  }, [searchParams]);

  async function findSlots(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setLoadingSlots(true);
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/visits/available-slots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prospectId: formData.get("prospectId"),
        propertyId: formData.get("propertyId"),
        rangeStart: new Date(String(formData.get("rangeStart"))).toISOString(),
        rangeEnd: new Date(String(formData.get("rangeEnd"))).toISOString(),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setLoadingSlots(false);
      setSlots([]);
      setError(data.error ?? "Impossible de calculer les plages disponibles.");
      return;
    }

    setSlots(data.slots ?? []);
    setLoadingSlots(false);
    if (data.warning) {
      setNotice(data.warning);
    } else {
      setNotice(null);
    }
  }

  async function createVisit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const formData = new FormData(event.currentTarget);
    if (!selectedSlot) {
      setError("Selectionne une plage disponible avant de soumettre.");
      return;
    }

    const slot = slots.find((item) => item.startsAt === selectedSlot);
    if (!slot) {
      setError("La plage selectionnee est invalide.");
      return;
    }

    const csrf = await fetch("/api/csrf").then((r) => r.json());
    const response = await fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({
        prospectId: formData.get("prospectId"),
        propertyId: formData.get("propertyId"),
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        notes: formData.get("notes") || "",
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error ?? "Impossible de soumettre la demande.");
      return;
    }

    setSlots([]);
    setSelectedSlot("");
    setNotice("Demande enregistree avec statut PENDING_APPROVAL. Cette visite doit etre approuvee par Simon avant confirmation.");
    await load();
  }

  async function approve(id: string, approved: boolean) {
    setBusyActionId(id);
    setError(null);
    setNotice(null);
    const csrf = await fetch("/api/csrf").then((r) => r.json());
    const response = await fetch(`/api/visits/${id}/approve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({ approved }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusyActionId(null);
      setError(payload.error ?? "Action impossible.");
      return;
    }

    setNotice(approved ? "Visite confirmee." : "Visite refusee.");
    setBusyActionId(null);
    await load();
  }

  async function proposeAnotherTime(visit: Visit) {
    const proposed = window.prompt("Nouvelle date/heure (format AAAA-MM-JJTHH:MM)");
    if (!proposed) return;
    const startsAt = new Date(proposed);
    if (Number.isNaN(startsAt.getTime())) {
      setError("Format de date invalide.");
      return;
    }

    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    const csrf = await fetch("/api/csrf").then((r) => r.json());
    setBusyActionId(visit.id);
    const response = await fetch(`/api/visits/${visit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({
        action: "RESCHEDULE",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        notes: "Proposition d'une autre heure",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusyActionId(null);

    if (!response.ok) {
      setError(payload.error ?? "Impossible de proposer une autre heure.");
      return;
    }

    setNotice("Nouvelle heure proposee. La demande reste en attente d'approbation.");
    await load();
  }

  async function mutateVisit(visitId: string, action: "CANCEL" | "COMPLETE" | "NO_SHOW" | "ADD_NOTE") {
    const note = action === "ADD_NOTE" ? window.prompt("Ajouter une note") || "" : "";
    setBusyActionId(visitId);
    const csrf = await fetch("/api/csrf").then((r) => r.json());
    const response = await fetch(`/api/visits/${visitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({ action, notes: note }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusyActionId(null);
    if (!response.ok) {
      setError(payload.error ?? "Action impossible sur la visite.");
      return;
    }
    setNotice("Mise a jour enregistree.");
    await load();
  }

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const filteredVisits = visits.filter((visit) => {
    const starts = new Date(visit.startsAt);
    if (view === "TODAY") {
      return starts.toDateString() === now.toDateString();
    }
    if (view === "WEEK") {
      return starts >= now && starts <= weekEnd;
    }
    if (view === "PENDING") {
      return visit.status === "PENDING_APPROVAL";
    }
    if (view === "CONFIRMED") {
      return visit.status === "CONFIRMED";
    }
    return visit.status === "COMPLETED" || visit.status === "NO_SHOW";
  });

  const nextVisit = visits
    .filter((visit) => new Date(visit.startsAt) > now && visit.status === "CONFIRMED")
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  const viewButtons: Array<{ key: VisitsView; label: string }> = [
    { key: "TODAY", label: "Aujourd'hui" },
    { key: "WEEK", label: "Cette semaine" },
    { key: "PENDING", label: "En attente" },
    { key: "CONFIRMED", label: "Confirmees" },
    { key: "COMPLETED", label: "Terminees" },
  ];

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Visites</h2>
        <p className="text-sm text-emerald-800">Demandee {"->"} En attente d&apos;approbation {"->"} Confirmee/Refusee (30 min + tampon 30 min)</p>
      </div>

      <div className="card p-4 text-sm">
        {googleStatus?.connected
          ? "Google Agenda connecte et pret pour les confirmations manuelles."
          : googleStatus?.configured
            ? "Google Agenda configure mais non connecte. Les visites restent possibles en mode sans Google."
            : "Google Agenda non configure. Les visites restent possibles en mode sans Google."}
        {googleStatus?.needsReconnect ? <p className="mt-2 font-semibold text-red-700">Reconnexion Google requise.</p> : null}
      </div>

      {nextVisit ? (
        <div className="card grid gap-2 p-4 text-sm">
          <p className="text-xs font-semibold text-emerald-900">Prochaine visite</p>
          <p className="font-semibold">{nextVisit.property.address}</p>
          <p>{new Date(nextVisit.startsAt).toLocaleString("fr-CA")}</p>
          <a
            className="w-fit rounded-lg border border-emerald-300 px-3 py-2"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nextVisit.property.address}`)}`}
            target="_blank"
            rel="noreferrer"
          >
            Itineraire
          </a>
        </div>
      ) : null}

      <form onSubmit={findSlots} className="card grid gap-3 p-4 md:grid-cols-2">
        <select name="prospectId" required value={selectedProspectId} onChange={(e) => setSelectedProspectId(e.target.value)} className="rounded-lg border border-emerald-200 px-3 py-3">
          <option value="">Choisir un prospect</option>
          {prospects.map((prospect) => (
            <option key={prospect.id} value={prospect.id}>{prospect.name}</option>
          ))}
        </select>
        <select name="propertyId" required value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="rounded-lg border border-emerald-200 px-3 py-3">
          <option value="">Choisir un logement</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>{property.codeIsr} - {property.address}</option>
          ))}
        </select>
        <input name="rangeStart" type="datetime-local" required className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="rangeEnd" type="datetime-local" required className="rounded-lg border border-emerald-200 px-3 py-3" />
        <button className="rounded-lg border border-emerald-300 bg-white px-4 py-3 md:col-span-2" disabled={loadingSlots}>
          {loadingSlots ? "Recherche des plages..." : "Trouver les plages disponibles"}
        </button>
      </form>

      {slots.length > 0 ? (
        <div className="card grid gap-3 p-4">
          <p className="text-sm font-semibold">Selectionne une plage disponible:</p>
          <div className="grid gap-2">
            {slots.map((slot) => (
              <label key={slot.startsAt} className="flex items-center gap-2 rounded-lg border border-emerald-200 p-2 text-sm">
                <input
                  type="radio"
                  name="visit-slot"
                  checked={selectedSlot === slot.startsAt}
                  onChange={() => setSelectedSlot(slot.startsAt)}
                />
                <span>
                  {new Date(slot.startsAt).toLocaleString("fr-CA")} - {new Date(slot.endsAt).toLocaleTimeString("fr-CA")} ({slot.timeZone})
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <form onSubmit={createVisit} className="card grid gap-3 p-4 md:grid-cols-2">
        <select name="prospectId" required value={selectedProspectId} onChange={(e) => setSelectedProspectId(e.target.value)} className="rounded-lg border border-emerald-200 px-3 py-3">
          <option value="">Prospect de la demande</option>
          {prospects.map((prospect) => (
            <option key={prospect.id} value={prospect.id}>{prospect.name}</option>
          ))}
        </select>
        <select name="propertyId" required value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="rounded-lg border border-emerald-200 px-3 py-3">
          <option value="">Logement de la demande</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>{property.codeIsr} - {property.address}</option>
          ))}
        </select>
        <input name="notes" placeholder="Notes" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <p className="text-xs text-emerald-900 md:col-span-2">Cette visite doit etre approuvee par Simon avant d'etre confirmee.</p>
        <button className="rounded-lg bg-[var(--accent)] px-4 py-3 text-white md:col-span-2" disabled={!selectedSlot}>Soumettre la demande</button>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

      <div className="flex flex-wrap gap-2">
        {viewButtons.map((item) => (
          <button
            key={item.key}
            className={`rounded-lg px-3 py-2 text-sm ${view === item.key ? "bg-[var(--accent)] text-white" : "border border-emerald-300 bg-white"}`}
            onClick={() => setView(item.key)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filteredVisits.map((visit) => (
          <article key={visit.id} className="card grid gap-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold">{visit.prospect.name} {"->"} {visit.property.codeIsr}</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold">{visit.status}</span>
            </div>
            <p className="text-sm">
              {new Date(visit.startsAt).toLocaleString("fr-CA")} - {new Date(visit.endsAt).toLocaleTimeString("fr-CA")}
            </p>
            <p className="text-sm">{visit.property.address}</p>
            {visit.notes ? <p className="text-sm">Notes: {visit.notes}</p> : null}
            <div className="flex flex-wrap gap-2">
              <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={`tel:${visit.prospect.phone}`}>Appeler</a>
              <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={`sms:${visit.prospect.phone}`}>Texto</a>
              {visit.prospect.messengerUrl ? (
                <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={visit.prospect.messengerUrl} target="_blank" rel="noreferrer">Messenger</a>
              ) : null}
              <a
                className="rounded-lg border border-emerald-200 px-3 py-2 text-sm"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${visit.property.address}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Google Maps
              </a>
              {visit.status === "PENDING_APPROVAL" ? (
                <>
                  <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={() => approve(visit.id, true)} disabled={busyActionId === visit.id}>
                    Accepter
                  </button>
                  <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={() => approve(visit.id, false)} disabled={busyActionId === visit.id}>
                    Refuser
                  </button>
                  <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={() => proposeAnotherTime(visit)} disabled={busyActionId === visit.id}>
                    Proposer une autre heure
                  </button>
                </>
              ) : null}
              {visit.status === "CONFIRMED" ? (
                <>
                  <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={() => mutateVisit(visit.id, "CANCEL")} disabled={busyActionId === visit.id}>
                    Annuler
                  </button>
                  <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={() => mutateVisit(visit.id, "COMPLETE")} disabled={busyActionId === visit.id}>
                    Marquer terminee
                  </button>
                  <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={() => mutateVisit(visit.id, "NO_SHOW")} disabled={busyActionId === visit.id}>
                    Client absent
                  </button>
                </>
              ) : null}
              <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={() => mutateVisit(visit.id, "ADD_NOTE")} disabled={busyActionId === visit.id}>
                Ajouter une note
              </button>
              {visit.googleEventHtmlLink ? (
                <a className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" href={visit.googleEventHtmlLink} target="_blank" rel="noreferrer">
                  Evenement Google
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
