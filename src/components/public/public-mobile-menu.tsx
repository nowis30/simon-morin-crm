"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MobileLink = {
  href: string;
  label: string;
};

type Props = {
  links: MobileLink[];
  phoneTechnical: string;
};

export function PublicMobileMenu({ links, phoneTechnical }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = "";
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="public-mobile-menu-panel"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-amber-200 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm md:hidden"
      >
        Menu
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/45 md:hidden" onClick={() => setIsOpen(false)}>
          <div
            id="public-mobile-menu-panel"
            className="absolute inset-x-2 top-2 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">Navigation</p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 text-lg text-slate-700"
                aria-label="Fermer le menu"
              >
                ×
              </button>
            </div>

            <nav className="grid gap-2">
              {links.map((link) => {
                const isCall = link.href.startsWith("tel:");
                const classes = isCall
                  ? "min-h-12 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white"
                  : "min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900";

                if (isCall) {
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={classes}
                    >
                      {link.label}
                    </a>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={classes}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <a
              href={`tel:${phoneTechnical}`}
              onClick={() => setIsOpen(false)}
              className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
            >
              Appeler maintenant
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}
