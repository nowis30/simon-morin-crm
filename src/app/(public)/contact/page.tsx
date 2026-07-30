import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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
    <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 md:grid-cols-[1fr_1fr] md:px-6 md:py-10">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Logo Simon Morin" width={742} height={503} className="h-14 w-auto object-contain" priority />
          <div>
            <h1 className="text-2xl font-black text-slate-900">Simon Morin</h1>
            <p className="text-sm text-slate-700">Agent de location</p>
          </div>
        </div>
        <p className="text-sm text-slate-700">Drummondville et les environs</p>
        <p className="text-sm text-slate-700">{phone}</p>
        <p className="text-sm text-slate-700">{email}</p>

        <div className="grid gap-3">
          <a href={`tel:${OFFICIAL_PUBLIC_PHONE_TECHNICAL}`} className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-emerald-600 px-5 text-center text-base font-semibold text-white hover:bg-emerald-500">
            Appeler 819-388-3407
          </a>
          <a href={`mailto:${OFFICIAL_PUBLIC_EMAIL}`} className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-5 text-center text-base font-semibold text-emerald-700 hover:bg-emerald-100">
            Envoyer un courriel
          </a>
          {messengerUrl ? (
            <a href={messengerUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-slate-200 px-5 text-center text-base font-semibold text-slate-700 hover:bg-slate-100">
              Ouvrir Messenger
            </a>
          ) : null}
          <Link href="/logements" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full border border-slate-200 px-5 text-center text-base font-semibold text-slate-800 hover:bg-slate-50">
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
