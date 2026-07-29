import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyAdmin } from "@/lib/auth";
import { MobileNav } from "@/components/mobile-nav";

export const dynamic = "force-dynamic";

const links = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/properties", label: "Logements" },
  { href: "/prospects", label: "Prospects" },
  { href: "/matches", label: "Correspondances" },
  { href: "/marketing", label: "Marketing" },
  { href: "/marketing/approval", label: "Approbation Facebook" },
  { href: "/visits", label: "Visites" },
  { href: "/visits/pending", label: "Visites en attente" },
  { href: "/placements", label: "Placements" },
  { href: "/commissions", label: "Commissions" },
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
    <div className="shell-bg min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div>
          <h1 className="font-[family-name:var(--font-barlow-condensed)] text-3xl font-bold tracking-wide">
            Simon Morin - Agent de location
          </h1>
          <p className="text-sm text-emerald-800">Gestion ISR - version initiale</p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-md bg-white/80 px-3 py-2 text-sm">{user.email}</span>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold">Deconnexion</button>
          </form>
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 pb-10 md:grid-cols-[240px_1fr] md:px-6">
        <aside className="card hidden h-fit p-3 md:block">
          <nav className="grid gap-2">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm hover:bg-emerald-100">
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="grid gap-4">
          <MobileNav />
          {children}
        </main>
      </div>
    </div>
  );
}
