// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ListingPhotoGallery } from "@/components/public/listing-photo-gallery";

const unitPhotos = [
  { url: "https://cdn.example.com/vertical.jpg", description: "Verticale" },
  { url: "https://cdn.example.com/horizontal.jpg", description: "Horizontale" },
  { url: "https://cdn.example.com/square.jpg", description: "Carree" },
];

describe("listing photo gallery", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
  });

  it("uses contain mode and mobile-safe frame classes", () => {
    render(<ListingPhotoGallery title="Logement test" unitPhotos={unitPhotos} />);

    const mainImage = screen.getByTestId("listing-gallery-main-image");
    const frame = screen.getByTestId("listing-gallery-frame");
    const root = screen.getByTestId("listing-gallery-root");

    expect(mainImage.className).toContain("object-contain");
    expect(frame.className).toContain("bg-slate-950");
    expect(frame.className).toContain("md:aspect-[4/3]");
    expect(root.className).toContain("overflow-x-hidden");
    expect(screen.getByText("1 / 3")).toBeTruthy();
  });

  it("opens fullscreen with h-dvh and can close it", () => {
    render(<ListingPhotoGallery title="Logement test" unitPhotos={unitPhotos} />);

    fireEvent.click(screen.getByRole("button", { name: "Agrandir" }));
    const fullscreen = screen.getByTestId("listing-gallery-fullscreen");
    expect(fullscreen.className).toContain("h-dvh");

    const close = screen.getByRole("button", { name: "Fermer la galerie" });
    fireEvent.click(close);

    expect(screen.queryByTestId("listing-gallery-fullscreen")).toBeNull();
  });

  it("supports next/previous buttons and swipe navigation", () => {
    render(<ListingPhotoGallery title="Logement test" unitPhotos={unitPhotos} />);

    const frame = screen.getByTestId("listing-gallery-frame");
    fireEvent.click(screen.getByRole("button", { name: "Photo suivante" }));
    expect(screen.getByText("2 / 3")).toBeTruthy();

    fireEvent.touchStart(frame, { touches: [{ clientX: 280, clientY: 250 }] });
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 220, clientY: 248 }] });
    expect(screen.getByText("3 / 3")).toBeTruthy();

    fireEvent.touchStart(frame, { touches: [{ clientX: 200, clientY: 250 }] });
    fireEvent.touchEnd(frame, { changedTouches: [{ clientX: 198, clientY: 310 }] });
    expect(screen.getByText("3 / 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Photo precedente" }));
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("hides arrows when there is a single photo", () => {
    render(<ListingPhotoGallery title="Logement test" unitPhotos={[unitPhotos[0]]} />);

    expect(screen.queryByRole("button", { name: "Photo precedente" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Photo suivante" })).toBeNull();
    expect(screen.getByText("1 / 1")).toBeTruthy();
  });

  it("marks active thumbnail and exposes original-link actions", () => {
    render(<ListingPhotoGallery title="Logement test" unitPhotos={unitPhotos} />);

    const activeThumb = screen.getAllByRole("button").find((node) => node.getAttribute("aria-current") === "true");
    expect(activeThumb).toBeTruthy();

    const openOriginal = screen.getByRole("link", { name: "Ouvrir la photo originale" });
    expect(openOriginal.getAttribute("target")).toBe("_blank");
    expect(openOriginal.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows a fallback and allows moving to the next photo after a load error", () => {
    render(<ListingPhotoGallery title="Logement test" unitPhotos={unitPhotos.slice(0, 2)} />);

    fireEvent.error(screen.getByTestId("listing-gallery-main-image"));
    expect(screen.getByTestId("listing-gallery-fallback")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Passer a la photo suivante" }));
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it.each([
    [320, 568],
    [360, 800],
    [375, 667],
    [390, 844],
    [430, 932],
    [1280, 800],
  ])("keeps stable mobile/desktop classes for %ix%i", (width) => {
    Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
    render(<ListingPhotoGallery title="Logement test" unitPhotos={unitPhotos} />);

    const frame = screen.getByTestId("listing-gallery-frame");
    expect(frame.className).toContain("md:aspect-[4/3]");
    expect(frame.className).toContain("bg-slate-950");
  });
});
