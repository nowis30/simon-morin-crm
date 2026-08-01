import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { env } from "@/lib/env";
import { getPublicAppUrl } from "@/lib/public-url";
import { PublicBottomNav } from "@/components/public/public-bottom-nav";
import { PublicMobileMenu } from "@/components/public/public-mobile-menu";

const OFFICIAL_PUBLIC_EMAIL = "simonmorin@nowis.store";
const OFFICIAL_PUBLIC_PHONE_DISPLAY = "819-388-3407";
const OFFICIAL_PUBLIC_PHONE_TECHNICAL = "+18193883407";

export const metadata: Metadata = {
  title: {
    default: "Logements a louer a Drummondville | Simon Morin",
    template: "%s | Simon Morin",
  },
  description:
    "Decouvrez les logements disponibles a Drummondville et dans les environs. Consultez les photos, les caracteristiques et envoyez votre demande de visite.",
  metadataBase: new URL(getPublicAppUrl()),
  openGraph: {
    title: "Logements a louer a Drummondville | Simon Morin",
    description:
      "Decouvrez les logements disponibles a Drummondville et dans les environs. Consultez les photos, les caracteristiques et envoyez votre demande de visite.",
    url: "/",
    siteName: "Simon Morin - Agent de location",
    locale: "fr_CA",
    type: "website",
    images: [
      {
        url: "/annonce.png",
        width: 864,
        height: 1821,
        alt: "Logements a louer a Drummondville avec Simon Morin",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Logements a louer a Drummondville | Simon Morin",
    description:
      "Decouvrez les logements disponibles a Drummondville et dans les environs. Consultez les photos, les caracteristiques et envoyez votre demande de visite.",
    images: [
      {
        url: "/annonce.png",
        alt: "Logements a louer a Drummondville avec Simon Morin",
      },
    ],
  },
};

const publicLinks = [
  { href: "/", label: "Accueil" },
  { href: "/logements", label: "Logements" },
  { href: "/contact", label: "Contact" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const publicPhone = env.PUBLIC_CONTACT_PHONE?.trim() || OFFICIAL_PUBLIC_PHONE_DISPLAY;
  const publicEmail = env.PUBLIC_CONTACT_EMAIL?.trim() || OFFICIAL_PUBLIC_EMAIL;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-amber-50 via-slate-50 to-emerald-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-amber-200/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl min-w-0 items-center justify-between gap-2 px-4 py-3 md:px-6 md:py-4">
          <Link href="/" className="flex min-w-0 items-center gap-2 text-slate-900" aria-label="Accueil Simon Morin">
            <Image
              src="/logo.png"
              alt="Simon Morin - Agent de location"
              width={742}
              height={503}
              className="h-10 w-auto object-contain md:h-12"
              priority
            />
            <span className="truncate text-sm font-bold tracking-tight sm:text-base">Simon Morin</span>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            {publicLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-amber-100 hover:text-slate-900">
                {link.label}
              </Link>
            ))}
            <Link href="/logements" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">
              Trouver un logement
            </Link>
          </nav>

          <PublicMobileMenu
            phoneTechnical={OFFICIAL_PUBLIC_PHONE_TECHNICAL}
            links={[
              ...publicLinks,
              { href: `tel:${OFFICIAL_PUBLIC_PHONE_TECHNICAL}`, label: "Appeler Simon" },
            ]}
          />
        </div>
      </header>

      <main className="overflow-x-hidden pb-[calc(env(safe-area-inset-bottom)+5.25rem)] md:pb-0">{children}</main>

      <footer className="mt-10 border-t border-slate-200 bg-white/95">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-2 md:px-6 md:py-8">
          <div className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">Simon Morin</h2>
            <p className="text-sm text-slate-700">Agent de location</p>
            <p className="text-sm text-slate-700">Drummondville et les environs</p>
            <p className="text-sm text-slate-700">Telephone: <a href={`tel:${OFFICIAL_PUBLIC_PHONE_TECHNICAL}`} className="underline decoration-dotted underline-offset-2 hover:text-slate-900">{publicPhone}</a></p>
            <p className="text-sm text-slate-700">Courriel: <a href={`mailto:${publicEmail}`} className="underline decoration-dotted underline-offset-2 hover:text-slate-900">{publicEmail}</a></p>
            <Link href="/logements" className="inline-flex min-h-11 items-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500">
              Voir les logements
            </Link>
          </div>
          <div className="space-y-2 text-left md:text-right">
            <Link href="/privacy" className="block text-sm text-slate-700 hover:text-slate-900">
              Politique de confidentialite
            </Link>
            <Link href="/login" className="inline-block text-xs text-slate-500 hover:text-slate-700">
              Connexion administrateur
            </Link>
          </div>
        </div>
      </footer>

      <PublicBottomNav />
    </div>
  );
}
