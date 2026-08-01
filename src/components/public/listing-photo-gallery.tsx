"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const SWIPE_THRESHOLD_PX = 45;

export function ListingPhotoGallery({ title, unitPhotos, buildingPhotos }: Props) {
  const allPhotos = useMemo(() => {
    const combined = [...toPhotoList(unitPhotos), ...toPhotoList(buildingPhotos)];
    return dedupeListingPhotos(combined);
  }, [unitPhotos, buildingPhotos]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<Record<string, true>>({});
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setActiveIndex(0);
    setIsLoaded(false);
    setBrokenUrls({});
  }, [unitPhotos, buildingPhotos]);

  useEffect(() => {
    setIsLoaded(false);
  }, [activeIndex]);

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
  const activePhotoBroken = Boolean(brokenUrls[activePhoto.url]);
  const hasMultiplePhotos = allPhotos.length > 1;

  const goTo = (nextIndex: number) => {
    setActiveIndex((nextIndex + allPhotos.length) % allPhotos.length);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    const firstTouch = event.touches[0];
    if (!firstTouch) return;
    touchStartRef.current = { x: firstTouch.clientX, y: firstTouch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    const firstTouch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !firstTouch) return;

    const deltaX = firstTouch.clientX - start.x;
    const deltaY = firstTouch.clientY - start.y;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

    if (deltaX < 0) {
      goTo(activeIndex + 1);
    } else {
      goTo(activeIndex - 1);
    }
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
  };

  const safeAreaPadding = {
    paddingTop: "env(safe-area-inset-top)",
    paddingBottom: "env(safe-area-inset-bottom)",
  } as const;

  return (
    <div className="space-y-3 overflow-x-hidden" data-testid="listing-gallery-root">
      <div
        className="relative w-full bg-slate-950 md:aspect-[4/3] md:h-auto md:overflow-hidden md:rounded-2xl md:border md:border-slate-200"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{ touchAction: "pan-y" }}
        data-testid="listing-gallery-frame"
      >
        <div className="relative h-[58vh] min-h-[320px] max-h-[620px] w-full md:aspect-[4/3] md:h-auto md:max-h-none md:min-h-0">
          {!activePhotoBroken ? (
            <Image
              src={activePhoto.url}
              alt={activePhoto.description || title}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 70vw, 65vw"
              className="object-contain transition-opacity duration-300"
              priority={activeIndex === 0}
              onLoad={() => setIsLoaded(true)}
              onError={() => {
                setBrokenUrls((current) => ({ ...current, [activePhoto.url]: true }));
                setIsLoaded(true);
              }}
              data-testid="listing-gallery-main-image"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-900 px-4 text-center text-sm text-slate-200" data-testid="listing-gallery-fallback">
              <p>Impossible de charger cette photo.</p>
              {hasMultiplePhotos ? (
                <button
                  type="button"
                  onClick={() => goTo(activeIndex + 1)}
                  className="inline-flex min-h-11 items-center rounded-full border border-slate-500 px-4 font-semibold text-white"
                >
                  Passer a la photo suivante
                </button>
              ) : null}
            </div>
          )}

          {!isLoaded && !activePhotoBroken ? <div className="absolute inset-0 animate-pulse bg-slate-800/70" /> : null}

          <div className="absolute left-2 top-2 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
            {activeIndex + 1} / {allPhotos.length}
          </div>

          {hasMultiplePhotos ? (
            <button
              type="button"
              onClick={() => goTo(activeIndex - 1)}
              className="absolute left-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-lg text-white"
              aria-label="Photo precedente"
            >
              ←
            </button>
          ) : null}

          {hasMultiplePhotos ? (
            <button
              type="button"
              onClick={() => goTo(activeIndex + 1)}
              className="absolute right-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-lg text-white"
              aria-label="Photo suivante"
            >
              →
            </button>
          ) : null}

          <div className="absolute bottom-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-black/60 px-3 text-xs font-semibold text-white"
            >
              Agrandir
            </button>
            <a
              href={activePhoto.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-black/60 px-3 text-xs font-semibold text-white"
            >
              Ouvrir la photo originale
            </a>
          </div>
        </div>
      </div>

      <div className="flex snap-x gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
        {allPhotos.map((photo, index) => (
          <button
            key={`${photo.url}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`snap-start relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-lg border ${activeIndex === index ? "border-emerald-500 ring-2 ring-emerald-400" : "border-slate-300"}`}
            aria-current={activeIndex === index}
          >
            <Image
              src={photo.url}
              alt={photo.description || `${title} ${index + 1}`}
              fill
              unoptimized
              sizes="72px"
              className="object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {isFullscreen ? (
        <div
          className="fixed inset-0 z-[100] h-dvh w-screen bg-black"
          onClick={() => setIsFullscreen(false)}
          data-testid="listing-gallery-fullscreen"
        >
          <div
            className="relative flex h-full w-full items-center justify-center"
            style={{ ...safeAreaPadding, touchAction: "pan-y" }}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchCancel}
          >
            {!activePhotoBroken ? (
              <Image
                src={activePhoto.url}
                alt={activePhoto.description || title}
                width={2000}
                height={1400}
                unoptimized
                sizes="100vw"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-slate-200">
                Cette photo est indisponible.
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="absolute right-2 inline-flex min-h-12 min-w-12 items-center justify-center rounded-full bg-black/60 text-xl text-white"
              style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
              aria-label="Fermer la galerie"
            >
              ✕
            </button>

            {hasMultiplePhotos ? (
              <button
                type="button"
                onClick={() => goTo(activeIndex - 1)}
                className="absolute left-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg text-white"
                aria-label="Photo precedente"
              >
                ←
              </button>
            ) : null}

            {hasMultiplePhotos ? (
              <button
                type="button"
                onClick={() => goTo(activeIndex + 1)}
                className="absolute right-2 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg text-white"
                aria-label="Photo suivante"
              >
                →
              </button>
            ) : null}

            <div
              className="absolute left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-sm text-white"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
            >
              {activeIndex + 1} / {allPhotos.length}
            </div>

            <a
              href={activePhoto.url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute left-2 rounded-full bg-black/60 px-3 py-2 text-xs font-semibold text-white"
              style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}
            >
              Ouvrir la photo originale
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
