import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/lib/env";
import { PublicContactForm } from "@/components/public/contact-form";

const OFFICIAL_PUBLIC_EMAIL = "simonmorin@nowis.store";
const OFFICIAL_PUBLIC_PHONE_DISPLAY = "819-388-3407";
const OFFICIAL_PUBLIC_PHONE_TECHNICAL = "+18193883407";

export const metadata: Metadata = {
  title: "Contact",
  alternates: {
    canonical: "/contact",
  },
};

export default function PublicContactPage() {
  const phone = env.PUBLIC_CONTACT_PHONE?.trim() || OFFICIAL_PUBLIC_PHONE_DISPLAY;
  const email = env.PUBLIC_CONTACT_EMAIL?.trim() || OFFICIAL_PUBLIC_EMAIL;
  const messengerUrl = env.PUBLIC_MESSENGER_URL?.trim();

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1fr_1fr] md:px-6">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900">Simon Morin</h1>
        <p className="text-sm text-slate-700">Agent de location</p>
        <p className="text-sm text-slate-700">Drummondville et les environs</p>
        <p className="text-sm text-slate-700">819-388-3407</p>
        <p className="text-sm text-slate-700">simonmorin@nowis.store</p>

        <div className="flex flex-wrap gap-3">
          <a href={`tel:${OFFICIAL_PUBLIC_PHONE_TECHNICAL}`} className="w-full rounded-full border border-emerald-200 px-5 py-3 text-center text-base font-semibold text-emerald-700 hover:bg-emerald-50 sm:w-auto">
            Appeler Simon
          </a>
          <a href={`mailto:${OFFICIAL_PUBLIC_EMAIL}`} className="w-full rounded-full border border-emerald-200 px-5 py-3 text-center text-base font-semibold text-emerald-700 hover:bg-emerald-50 sm:w-auto">
            Envoyer un courriel
          </a>
          {messengerUrl ? (
            <a href={messengerUrl} target="_blank" rel="noreferrer" className="w-full rounded-full border border-emerald-200 px-5 py-3 text-center text-base font-semibold text-emerald-700 hover:bg-emerald-50 sm:w-auto">
              Ouvrir Messenger
            </a>
          ) : null}
          <Link href="/logements" className="w-full rounded-full bg-emerald-600 px-5 py-3 text-center text-base font-semibold text-white hover:bg-emerald-500 sm:w-auto">
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
