"use client";

import { useEffect, useState } from "react";

type Props = {
  priceLabel: string;
  targetId: string;
};

export function MobileVisitCta({ priceLabel, targetId }: Props) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(!entry.isIntersecting);
      },
      { threshold: 0.15 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  function scrollToForm() {
    const target = document.getElementById(targetId);
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3rem)] z-30 border-t border-slate-200 bg-white/95 px-3 py-2.5 shadow-[0_-6px_24px_rgba(15,23,42,0.12)] md:hidden">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Prix mensuel</p>
          <p className="truncate text-xs font-bold text-slate-900">{priceLabel}</p>
        </div>
        <button
          type="button"
          onClick={scrollToForm}
          className="ml-auto inline-flex min-h-11 items-center justify-center rounded-full bg-emerald-600 px-3.5 text-xs font-semibold text-white"
        >
          Demander une visite
        </button>
      </div>
    </div>
  );
}
