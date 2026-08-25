"use client";

export function InvoicePrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="invoice-no-print rounded-xl bg-[var(--accent)] px-5 py-3 font-bold text-white"
    >
      Imprimer / enregistrer en PDF
    </button>
  );
}
