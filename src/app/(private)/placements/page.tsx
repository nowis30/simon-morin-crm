"use client";

import { useEffect, useState } from "react";

type Prospect = { id: string; name: string };
type Property = { id: string; codeIsr: string; address: string };
type Visit = { id: string; prospect: { id: string; name: string }; property: { id: string; codeIsr: string } };
type Placement = {
  id: string;
  notes: string | null;
  prospect: { name: string };
  property: { codeIsr: string; address: string };
  commission: { plannedAmount: number; status: string } | null;
};

export default function PlacementsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [items, setItems] = useState<Placement[]>([]);

  async function load() {
    const [prospectsData, propertiesData, visitsData, placementsData] = await Promise.all([
      fetch("/api/prospects").then((response) => response.json()),
      fetch("/api/properties").then((response) => response.json()),
      fetch("/api/visits").then((response) => response.json()),
      fetch("/api/placements").then((response) => response.json()),
    ]);

    setProspects((prospectsData.items ?? []).map((x: Prospect) => ({ id: x.id, name: x.name })));
    setProperties((propertiesData.items ?? []).map((x: Property) => ({ id: x.id, codeIsr: x.codeIsr, address: x.address })));
    setVisits(visitsData.items ?? []);
    setItems(placementsData.items ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function createPlacement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const csrf = await fetch("/api/csrf").then((r) => r.json());

    await fetch("/api/placements", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({
        prospectId: formData.get("prospectId"),
        propertyId: formData.get("propertyId"),
        visitId: formData.get("visitId") || undefined,
        visitDate: formData.get("visitDate") || undefined,
        sentToColleaguesDate: formData.get("sentToColleaguesDate") || undefined,
        acceptanceDate: formData.get("acceptanceDate") || undefined,
        signatureDate: formData.get("signatureDate") || undefined,
        moveInDate: formData.get("moveInDate") || undefined,
        notes: formData.get("notes") || "",
      }),
    });

    event.currentTarget.reset();
    await load();
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Placements et commissions</h2>
        <p className="text-sm text-emerald-800">Commission prevue automatique de 500$ par logement loue</p>
      </div>

      <form onSubmit={createPlacement} className="card grid gap-3 p-4 md:grid-cols-2">
        <select name="prospectId" required className="rounded-lg border border-emerald-200 px-3 py-3">
          <option value="">Prospect</option>
          {prospects.map((prospect) => (
            <option key={prospect.id} value={prospect.id}>{prospect.name}</option>
          ))}
        </select>
        <select name="propertyId" required className="rounded-lg border border-emerald-200 px-3 py-3">
          <option value="">Logement</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>{property.codeIsr} - {property.address}</option>
          ))}
        </select>
        <select name="visitId" className="rounded-lg border border-emerald-200 px-3 py-3 md:col-span-2">
          <option value="">Visite associee (optionnel)</option>
          {visits.map((visit) => (
            <option key={visit.id} value={visit.id}>{visit.prospect.name} - {visit.property.codeIsr}</option>
          ))}
        </select>
        <input type="date" name="visitDate" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input type="date" name="sentToColleaguesDate" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input type="date" name="acceptanceDate" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input type="date" name="signatureDate" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input type="date" name="moveInDate" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <textarea name="notes" className="rounded-lg border border-emerald-200 px-3 py-3 md:col-span-2" placeholder="Notes" />
        <button className="rounded-lg bg-[var(--accent)] px-4 py-3 text-white md:col-span-2">Creer placement</button>
      </form>

      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="card grid gap-2 p-4">
            <h3 className="text-lg font-bold">{item.prospect.name} {"->"} {item.property.codeIsr}</h3>
            <p className="text-sm">Commission prevue: {item.commission?.plannedAmount ?? 0}$ | Statut: {item.commission?.status ?? "N/A"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
