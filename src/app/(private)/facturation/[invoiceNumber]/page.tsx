import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoicePrintButton } from "@/components/invoice-print-button";

function money(value: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(value);
}

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("fr-CA", { year: "numeric", month: "long", day: "numeric" }).format(value);
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceNumber: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { invoiceNumber: rawInvoiceNumber } = await params;
  const invoiceNumber = decodeURIComponent(rawInvoiceNumber);
  const commissions = await prisma.commission.findMany({
    where: { invoiceNumber },
    include: {
      placement: {
        include: { prospect: true, property: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!commissions.length) notFound();

  const billedAt = commissions.find((item) => item.billedAt)?.billedAt ?? commissions[0].createdAt;
  const total = commissions.reduce((sum, item) => sum + (item.invoicedAmount ?? item.plannedAmount), 0);

  return (
    <section className="grid gap-4">
      <div className="invoice-no-print flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/facturation" className="font-semibold text-emerald-800 hover:underline">
          ← Retour à la facturation
        </Link>
        <InvoicePrintButton />
      </div>

      <article id="invoice-print" className="mx-auto w-full max-w-4xl rounded-2xl bg-white p-5 shadow-sm sm:p-8">
        <header className="grid gap-6 border-b border-slate-200 pb-6 sm:grid-cols-2 sm:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">Facture</p>
            <h2 className="mt-1 font-[family-name:var(--font-barlow-condensed)] text-4xl font-black">{invoiceNumber}</h2>
            <p className="mt-2 text-sm text-slate-600">Date : {dateLabel(billedAt)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-lg font-black">Simon Morin</p>
            <p className="text-sm">Agent de location / Commercial</p>
            <p className="text-sm font-semibold">nowis.store</p>
            <p className="text-sm">{user.email}</p>
          </div>
        </header>

        <div className="grid gap-5 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Facturé à</p>
            <p className="mt-1 text-lg font-bold">Gestion ISR</p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Objet</p>
            <p className="mt-1 font-semibold">Services de location immobilière</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50">
                <th className="px-3 py-3">Locataire</th>
                <th className="px-3 py-3">Logement</th>
                <th className="px-3 py-3">Service</th>
                <th className="px-3 py-3 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-4 font-semibold">{item.placement.prospect.name}</td>
                  <td className="px-3 py-4">
                    <strong className="block">{item.placement.property.codeIsr}</strong>
                    <span className="text-slate-600">{item.placement.property.address}, {item.placement.property.city}</span>
                  </td>
                  <td className="px-3 py-4">Logement loué</td>
                  <td className="px-3 py-4 text-right font-bold">{money(item.invoicedAmount ?? item.plannedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-6 w-full max-w-sm border-t-2 border-slate-950 pt-4">
          <div className="flex items-center justify-between text-xl font-black">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-500">
          <p>Facture générée depuis le CRM de Simon Morin.</p>
        </footer>
      </article>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print, #invoice-print * { visibility: visible !important; }
          #invoice-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none;
            margin: 0;
            padding: 24px;
            border-radius: 0;
            box-shadow: none;
          }
          .invoice-no-print { display: none !important; }
          @page { margin: 12mm; }
        }
      `}</style>
    </section>
  );
}
