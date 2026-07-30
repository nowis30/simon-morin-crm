"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { dedupeListingPhotos, type ListingPhoto } from "@/lib/public-listings";

type Props = {
  title: string;
  unitPhotos: ListingPhoto[];
  buildingPhotos?: ListingPhoto[];
};

function toPhotoList(photoList: ListingPhoto[] = []) {
  return dedupeListingPhotos(photoList);
}

export function ListingPhotoGallery({ title, unitPhotos, buildingPhotos }: Props) {
  const allPhotos = useMemo(() => {
    const combined = [...toPhotoList(unitPhotos), ...toPhotoList(buildingPhotos)];
    return dedupeListingPhotos(combined);
  }, [unitPhotos, buildingPhotos]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setActiveIndex(0);
    setIsLoaded(false);
  }, [unitPhotos, buildingPhotos]);

  useEffect(() => {
    if (!isFullscreen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
      if (event.key === "ArrowRight") {
        setActiveIndex((current) => (current + 1) % allPhotos.length);
      }
      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => (current - 1 + allPhotos.length) % allPhotos.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allPhotos.length, isFullscreen]);

  if (allPhotos.length === 0) {
    return null;
  }

  const activePhoto = allPhotos[activeIndex];

  const goTo = (nextIndex: number) => {
    setActiveIndex((nextIndex + allPhotos.length) % allPhotos.length);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const startX = event.touches[0]?.clientX ?? 0;
    const startY = event.touches[0]?.clientY ?? 0;
    (event.currentTarget as HTMLElement).dataset.touchStartX = String(startX);
    (event.currentTarget as HTMLElement).dataset.touchStartY = String(startY);
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const startX = Number((event.currentTarget as HTMLElement).dataset.touchStartX ?? 0);
    const startY = Number((event.currentTarget as HTMLElement).dataset.touchStartY ?? 0);
    const endX = event.changedTouches[0]?.clientX ?? 0;
    const endY = event.changedTouches[0]?.clientY ?? 0;
    const deltaX = endX - startX;
    const deltaY = endY - startY;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        goTo(activeIndex + 1);
      } else {
        goTo(activeIndex - 1);
      }
    }
  };

  return (
    <div className="space-y-3 overflow-x-hidden">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 sm:p-3">
        <div
          className="group relative overflow-hidden rounded-xl bg-slate-100"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={activePhoto.url}
              alt={activePhoto.description || title}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 65vw"
              className="object-cover transition duration-300"
              loading="lazy"
              onLoad={() => setIsLoaded(true)}
            />
          </div>
          {!isLoaded ? <div className="absolute inset-0 animate-pulse bg-slate-200" /> : null}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-900/85 to-transparent px-3 py-3 text-xs text-white">
            <span>{title}</span>
            <span>{activeIndex + 1} / {allPhotos.length}</span>
          </div>
          <button
            type="button"
            onClick={() => goTo(activeIndex - 1)}
            className="absolute left-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-slate-900/70 text-lg text-white"
            aria-label="Photo precedente"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => goTo(activeIndex + 1)}
            className="absolute right-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-slate-900/70 text-lg text-white"
            aria-label="Photo suivante"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreen(true)}
            className="absolute right-2 top-2 inline-flex min-h-11 items-center rounded-full border border-white/40 bg-slate-900/70 px-3 text-xs text-white"
          >
            Plein écran
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {allPhotos.map((photo, index) => (
          <button
            key={`${photo.url}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`relative h-16 w-20 flex-shrink-0 overflow-hidden rounded-lg border ${activeIndex === index ? "border-emerald-500" : "border-slate-300"}`}
          >
            <Image
              src={photo.url}
              alt={photo.description || `${title} ${index + 1}`}
              fill
              unoptimized
              sizes="80px"
              className="object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {isFullscreen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4" onClick={() => setIsFullscreen(false)}>
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <img src={activePhoto.url} alt={activePhoto.description || title} className="max-h-[85vh] w-full object-contain" />
            <button type="button" onClick={() => setIsFullscreen(false)} className="absolute right-3 top-3 rounded-full bg-slate-900/80 px-3 py-2 text-sm text-white">Fermer</button>
            <button type="button" onClick={() => goTo(activeIndex - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/80 px-3 py-2 text-sm text-white">←</button>
            <button type="button" onClick={() => goTo(activeIndex + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-slate-900/80 px-3 py-2 text-sm text-white">→</button>
            <div className="mt-3 text-center text-sm text-slate-300">{activeIndex + 1} / {allPhotos.length}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
