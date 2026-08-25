"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AvailableCommission = {
  id: string;
  plannedAmount: number;
  status: string;
  tenantName: string;
  propertyCode: string;
  address: string;
  city: string;
  moveInDate: string | null;
};

type Invoice = {
  number: string;
  billedAt: string | null;
  total: number;
  lines: Array<{
    id: string;
    commissionId: string;
    tenantName: string;
    propertyCode: string;
    address: string;
    city: string;
    amount: number;
  }>;
};

type Sender = { name: string; title: string; business: string; email: string };

function money(value: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(value);
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export default function FacturationPage() {
  const [available, setAvailable] = useState<AvailableCommission[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sender, setSender] = useState<Sender | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function csrfToken() {
    const response = await fetch("/api/csrf");
    const data = await response.json();
    return data.token as string;
  }

  async function load() {
    setError("");
    const response = await fetch("/api/invoices");
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Impossible de charger la facturation.");
      return;
    }
    setAvailable(data.available || []);
    setInvoices(data.invoices || []);
    setSender(data.sender || null);
    setAmounts((current) => {
      const next = { ...current };
      for (const item of data.available || []) {
        if (next[item.id] == null) next[item.id] = item.plannedAmount;
      }
      return next;
    });
  }

  useEffect(() => {
    void load();
  }, []);

  const total = useMemo(
    () => selected.reduce((sum, id) => sum + Number(amounts[id] || 0), 0),
    [selected, amounts],
  );

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function setAmount(id: string, value: number) {
    setAmounts((current) => ({ ...current, [id]: Math.max(0, Math.round(value || 0)) }));
  }

  async function createInvoice() {
    if (!selected.length) {
      setError("Sélectionne au moins un logement loué.");
      return;
    }
    if (selected.some((id) => !amounts[id] || amounts[id] <= 0)) {
      setError("Chaque ligne doit avoir un montant supérieur à 0 $.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": await csrfToken(),
        },
        body: JSON.stringify({
          lines: selected.map((commissionId) => ({ commissionId, amount: amounts[commissionId] })),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Impossible de créer la facture.");
        return;
      }
      setSelected([]);
      setNotice(`Facture ${data.invoice.number} créée pour ${money(data.invoice.total)}.`);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Facturation</h2>
          <p className="text-sm text-emerald-800">Regroupe plusieurs logements loués sur une seule facture à Gestion ISR.</p>
        </div>
        {sender ? (
          <div className="rounded-xl border border-emerald-200 bg-white/80 px-3 py-2 text-xs text-emerald-950">
            <strong>{sender.name}</strong> · {sender.business}<br />
            {sender.email}
          </div>
        ) : null}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{notice}</div> : null}

      <div className="card grid gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-xl font-bold">Nouvelle facture</h3>
            <p className="text-sm text-slate-600">Coche les locations à facturer et ajuste chaque montant.</p>
          </div>
          <div className="text-lg font-black">Total : {money(total)}</div>
        </div>

        <div className="grid gap-3">
          {available.length === 0 ? (
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/60 p-5 text-sm">
              Aucune commission en attente de facturation.
            </div>
          ) : (
            available.map((item) => {
              const checked = selected.includes(item.id);
              return (
                <article key={item.id} className={`rounded-2xl border p-4 ${checked ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                    <label className="flex min-w-0 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.id)}
                        className="mt-1 h-5 w-5 accent-emerald-700"
                      />
                      <span className="min-w-0">
                        <span className="block text-base font-bold">{item.tenantName}</span>
                        <span className="block text-sm text-slate-700">{item.propertyCode} · {item.address}, {item.city}</span>
                        {item.moveInDate ? <span className="block text-xs text-slate-500">Entrée : {dateLabel(item.moveInDate)}</span> : null}
                      </span>
                    </label>

                    <div className="grid gap-2 sm:grid-cols-[auto_120px] sm:items-center">
                      <div className="flex flex-wrap gap-1.5">
                        {[500, 600, 700].map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setAmount(item.id, value);
                              if (!checked) toggle(item.id);
                            }}
                            className={`rounded-lg border px-3 py-2 text-sm font-bold ${amounts[item.id] === value ? "border-emerald-600 bg-emerald-700 text-white" : "border-slate-200 bg-white"}`}
                          >
                            {value} $
                          </button>
                        ))}
                      </div>
                      <label className="grid gap-1 text-xs font-semibold text-slate-600">
                        Montant
                        <input
                          type="number"
                          min="1"
                          max="100000"
                          step="25"
                          value={amounts[item.id] ?? item.plannedAmount}
                          onChange={(event) => {
                            setAmount(item.id, Number(event.target.value));
                            if (!checked) setSelected((current) => [...current, item.id]);
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-bold text-slate-950"
                        />
                      </label>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <button
          type="button"
          disabled={saving || selected.length === 0}
          onClick={() => void createInvoice()}
          className="rounded-xl bg-[var(--accent)] px-5 py-3 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Création..." : `Créer la facture · ${money(total)}`}
        </button>
      </div>

      <div className="card grid gap-3 p-4 sm:p-5">
        <div>
          <h3 className="text-xl font-bold">Factures récentes</h3>
          <p className="text-sm text-slate-600">Ouvre une facture pour l’imprimer ou l’enregistrer en PDF.</p>
        </div>
        {invoices.length === 0 ? (
          <p className="text-sm text-slate-600">Aucune facture créée pour le moment.</p>
        ) : (
          <div className="grid gap-2">
            {invoices.map((invoice) => (
              <Link
                key={invoice.number}
                href={`/facturation/${encodeURIComponent(invoice.number)}`}
                className="grid gap-1 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-emerald-400 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <span>
                  <strong className="block">{invoice.number}</strong>
                  <span className="text-sm text-slate-600">{invoice.lines.length} logement{invoice.lines.length > 1 ? "s" : ""} · {dateLabel(invoice.billedAt)}</span>
                </span>
                <strong>{money(invoice.total)}</strong>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
