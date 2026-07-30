import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/lib/env";
import { PublicContactForm } from "@/components/public/contact-form";

export const metadata: Metadata = {
  title: "Contact",
  alternates: {
    canonical: "/contact",
  },
};

function normalizePhone(phone: string) {
  return phone.replace(/[^+\d]/g, "");
}

export default function PublicContactPage() {
  const phone = env.PUBLIC_CONTACT_PHONE?.trim();
  const email = env.PUBLIC_CONTACT_EMAIL?.trim();
  const messengerUrl = env.PUBLIC_MESSENGER_URL?.trim();

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1fr_1fr] md:px-6">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900">Simon Morin - Agent de location</h1>
        <p className="text-sm text-slate-700">Drummondville et environs</p>

        {phone ? <p className="text-sm text-slate-700">Telephone public: {phone}</p> : null}
        {email ? <p className="text-sm text-slate-700">Courriel public: {email}</p> : null}

        <div className="flex flex-wrap gap-3">
          {phone ? (
            <a href={`tel:${normalizePhone(phone)}`} className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              Appeler
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              Envoyer un courriel
            </a>
          ) : null}
          {messengerUrl ? (
            <a href={messengerUrl} target="_blank" rel="noreferrer" className="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              Ouvrir Messenger
            </a>
          ) : null}
          <Link href="/logements" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            Voir les logements disponibles
          </Link>
        </div>

        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Pour un logement precis, envoyez votre demande directement depuis la fiche du logement afin d'accelerer la confirmation.
        </p>
      </div>

      <PublicContactForm />
    </section>
  );
}
