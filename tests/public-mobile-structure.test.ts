import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("public mobile-first structure", () => {
  it("keeps bottom safe-area spacing and mobile bottom nav", () => {
    const layout = read("src/app/(public)/layout.tsx");
    expect(layout).toContain("pb-[calc(env(safe-area-inset-bottom)+5.25rem)]");
    expect(layout).toContain("<PublicBottomNav />");
  });

  it("uses one-column-first cards on listings page", () => {
    const listingsPage = read("src/app/(public)/logements/page.tsx");
    expect(listingsPage).toContain("grid gap-4 md:grid-cols-2 xl:grid-cols-3");
    expect(listingsPage).toContain("aspect-[4/3]");
    expect(listingsPage).toContain("Voir le logement");
  });

  it("keeps quick search fields and touch-friendly heights", () => {
    const homePage = read("src/app/(public)/page.tsx");
    expect(homePage).toContain("min-h-12 rounded-lg");
    expect(homePage).toContain("min-h-[52px] w-full rounded-full");

    const listingSearch = read("src/components/public/listing-search.tsx");
    expect(listingSearch).toContain("Plus de filtres");
    expect(listingSearch).toContain("Masquer les filtres");
    expect(listingSearch).toContain("text-base");
  });
});
