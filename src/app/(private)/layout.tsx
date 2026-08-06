import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, hasAnyAdmin } from "@/lib/auth";
import { MobileNav } from "@/components/mobile-nav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

const links = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/admin/logements", label: "Gestion des logements" },
  { href: "/prospects", label: "Prospects" },
  { href: "/matches", label: "Correspondances" },
  { href: "/marketing", label: "Marketing" },
  { href: "/marketing/approval", label: "Approbation Facebook" },
  { href: "/visits", label: "Visites" },
  { href: "/visits/pending", label: "Visites en attente" },
  { href: "/placements", label: "Placements" },
  { href: "/commissions", label: "Commissions" },
  { href: "/mileage", label: "Kilométrage et impôts" },
  { href: "/settings/calendar", label: "Calendrier" },
];

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const adminExists = await hasAnyAdmin();
  if (!adminExists) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="shell-bg min-h-screen overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-7xl flex-col items-start gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-4 md:px-6">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-barlow-condensed)] text-2xl font-bold leading-tight tracking-wide md:text-3xl">
            Simon Morin - Agent de location
          </h1>
          <p className="text-xs text-emerald-800 md:text-sm">Gestion ISR - version initiale</p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/" className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold">
            Voir le site public
          </Link>
          <Link href="/logements" className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold">
            Voir les logements publics
          </Link>
          <span className="max-w-[220px] truncate rounded-md bg-white/80 px-3 py-2 text-sm">{user.email}</span>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold">Deconnexion</button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl min-w-0 gap-4 px-4 pb-10 md:grid-cols-[240px_1fr] md:px-6">
        <aside className="card hidden h-fit p-3 md:block">
          <nav className="grid gap-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm hover:bg-emerald-100">
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="grid min-w-0 gap-4 overflow-x-hidden">
          <MobileNav />
          {children}
        </main>
      </div>
    </div>
  );
}
