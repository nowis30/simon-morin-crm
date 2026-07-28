"use client";

import { useEffect, useState } from "react";

type Commission = {
  id: string;
  plannedAmount: number;
  invoicedAmount: number | null;
  receivedAmount: number | null;
  status: string;
  placement: { prospect: { name: string }; property: { codeIsr: string } };
};

export default function CommissionsPage() {
  const [items, setItems] = useState<Commission[]>([]);
  const [totals, setTotals] = useState({
    monthly: { planned: 0, invoiced: 0, received: 0 },
    yearly: { planned: 0, invoiced: 0, received: 0 },
  });

  useEffect(() => {
    fetch("/api/commissions")
      .then((response) => response.json())
      .then((data) => {
        setItems(data.items ?? []);
        setTotals(data.totals ?? {
          monthly: { planned: 0, invoiced: 0, received: 0 },
          yearly: { planned: 0, invoiced: 0, received: 0 },
        });
      });
  }, []);

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Commissions</h2>
        <p className="text-sm text-emerald-800">Totaux mensuels et annuels</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <h3 className="font-bold">Mois courant</h3>
          <p>Prevues: {totals.monthly.planned}$</p>
          <p>Facturees: {totals.monthly.invoiced}$</p>
          <p>Recues: {totals.monthly.received}$</p>
        </div>
        <div className="card p-4">
          <h3 className="font-bold">Annee courante</h3>
          <p>Prevues: {totals.yearly.planned}$</p>
          <p>Facturees: {totals.yearly.invoiced}$</p>
          <p>Recues: {totals.yearly.received}$</p>
        </div>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="card grid gap-1 p-4 text-sm">
            <h3 className="font-bold">{item.placement.prospect.name} - {item.placement.property.codeIsr}</h3>
            <p>Prevue: {item.plannedAmount}$ | Facturee: {item.invoicedAmount ?? 0}$ | Recue: {item.receivedAmount ?? 0}$</p>
            <p>Statut: {item.status}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
