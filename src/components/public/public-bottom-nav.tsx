"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
};

const items: NavItem[] = [
  {
    href: "/",
    label: "Accueil",
    icon: "⌂",
    match: (pathname) => pathname === "/",
  },
  {
    href: "/logements",
    label: "Logements",
    icon: "▦",
    match: (pathname) => pathname === "/logements" || pathname.startsWith("/logements/"),
  },
  {
    href: "/contact",
    label: "Contact",
    icon: "✉",
    match: (pathname) => pathname.startsWith("/contact"),
  },
];

export function PublicBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid h-16 w-full max-w-3xl grid-cols-3 px-1.5">
        {items.map((item) => {
          const isActive = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-semibold ${
                  isActive ? "text-emerald-700" : "text-slate-600"
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
