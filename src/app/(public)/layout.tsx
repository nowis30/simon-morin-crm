import type { Metadata } from "next";
import Link from "next/link";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: {
    default: "Logements a louer a Drummondville | Simon Morin",
    template: "%s | Simon Morin",
  },
  description:
    "Decouvrez les logements disponibles a Drummondville et dans les environs. Consultez les photos, les caracteristiques et envoyez votre demande de visite.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
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
        width: 1200,
        height: 630,
        alt: "Logements a louer a Drummondville",
      },
    ],
  },
};

const publicLinks = [
  { href: "/", label: "Accueil" },
  { href: "/logements", label: "Logements disponibles" },
  { href: "/contact", label: "Contact" },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const publicPhone = env.PUBLIC_CONTACT_PHONE?.trim();
  const publicEmail = env.PUBLIC_CONTACT_EMAIL?.trim();

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-emerald-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-amber-200/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-6">
          <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
            Simon Morin - Agent de location
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

          <details className="relative md:hidden">
            <summary className="cursor-pointer list-none rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-slate-800">
              Menu
            </summary>
            <div className="absolute right-0 mt-2 grid min-w-64 gap-2 rounded-xl border border-amber-200 bg-white p-3 shadow-lg">
              {publicLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-amber-100">
                  {link.label}
                </Link>
              ))}
              <Link href="/logements" className="rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-semibold text-white">
                Trouver un logement
              </Link>
            </div>
          </details>
        </div>
      </header>

      <main>{children}</main>

      <footer className="mt-14 border-t border-amber-200 bg-slate-950 text-slate-200">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 md:grid-cols-2 md:px-6">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Simon Morin - Agent de location</h2>
            <p className="text-sm text-slate-300">Drummondville et environs</p>
            {publicEmail ? <p className="text-sm text-slate-300">Courriel: {publicEmail}</p> : null}
            {publicPhone ? <p className="text-sm text-slate-300">Telephone: {publicPhone}</p> : null}
          </div>
          <div className="space-y-3 md:text-right">
            <Link href="/privacy" className="block text-sm text-slate-300 hover:text-white">
              Politique de confidentialite
            </Link>
            <Link href="/login" className="inline-block text-xs text-slate-400 hover:text-slate-200">
              Connexion administrateur
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
