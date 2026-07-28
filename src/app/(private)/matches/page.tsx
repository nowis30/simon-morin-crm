"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Prospect = { id: string; name: string };
type MatchItem = {
  property: {
    id: string;
    codeIsr: string;
    address: string;
    city: string;
    district: string | null;
    monthlyPrice: number;
    bedrooms: number;
  };
  match: {
    score: number;
    reasons: string[];
  };
};

export default function MatchesPage() {
  const searchParams = useSearchParams();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<string>("");
  const [items, setItems] = useState<MatchItem[]>([]);

  const initialProspectId = useMemo(() => searchParams.get("prospectId") || "", [searchParams]);

  useEffect(() => {
    fetch("/api/prospects")
      .then((response) => response.json())
      .then((data) => {
        const list = (data.items ?? []).map((item: { id: string; name: string }) => ({ id: item.id, name: item.name }));
        setProspects(list);
        if (initialProspectId) {
          setSelectedProspect(initialProspectId);
        } else if (list[0]) {
          setSelectedProspect(list[0].id);
        }
      });
  }, [initialProspectId]);

  useEffect(() => {
    if (!selectedProspect) {
      return;
    }
    fetch(`/api/matches/${selectedProspect}`)
      .then((response) => response.json())
      .then((data) => setItems(data.items ?? []));
  }, [selectedProspect]);

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Correspondances</h2>
        <p className="text-sm text-emerald-800">Score sur 100 selon budget, secteur, chambres, date, animaux, stationnement</p>
      </div>

      <div className="card p-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Prospect</span>
          <select
            value={selectedProspect}
            onChange={(event) => setSelectedProspect(event.target.value)}
            className="rounded-lg border border-emerald-200 px-3 py-3"
          >
            <option value="">Choisir...</option>
            {prospects.map((prospect) => (
              <option key={prospect.id} value={prospect.id}>{prospect.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.property.id} className="card grid gap-2 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{item.property.codeIsr} - {item.property.address}</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold">{item.match.score}/100</span>
            </div>
            <p className="text-sm">{item.property.city}{item.property.district ? `, ${item.property.district}` : ""} - {item.property.monthlyPrice}$ / mois</p>
            <ul className="grid gap-1 text-sm">
              {item.match.reasons.map((reason) => (
                <li key={reason}>- {reason}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
