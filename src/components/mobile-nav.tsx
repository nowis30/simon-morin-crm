"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/properties", label: "Logements" },
  { href: "/prospects", label: "Prospects" },
  { href: "/matches", label: "Correspondances" },
  { href: "/marketing", label: "Marketing" },
  { href: "/visits", label: "Visites" },
  { href: "/visits/pending", label: "Visites en attente" },
  { href: "/placements", label: "Placements" },
  { href: "/commissions", label: "Commissions" },
  { href: "/settings/calendar", label: "Calendrier" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <button
        type="button"
        className="rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-bold text-white md:hidden"
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      {open ? (
        <div className="card mt-3 grid gap-2 p-3 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm ${pathname === link.href ? "bg-emerald-100 font-bold" : ""}`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <form action="/api/auth/logout" method="post">
            <button className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-left text-sm">Deconnexion</button>
          </form>
        </div>
      ) : null}
    </>
  );
}
