// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListingSearch } from "@/components/public/listing-search";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/logements",
  useSearchParams: () => new URLSearchParams("city=Drummondville&bedrooms=2"),
}));

describe("listing search UI", () => {
  it("resets filters", () => {
    render(<ListingSearch total={12} />);
    fireEvent.click(screen.getByText("Reinitialiser les filtres"));
    expect(pushMock).toHaveBeenCalledWith("/logements");
  });

  it("toggles advanced filters with mobile-first labels", () => {
    render(<ListingSearch total={12} />);

    const toggle = screen.getByRole("button", { name: "Plus de filtres" });
    const cityInput = screen.getByLabelText("Ville");
    const filtersContainer = cityInput.closest("div");
    expect(filtersContainer?.className).toContain("hidden");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Masquer les filtres" })).toBeTruthy();
    expect(screen.getByLabelText("Ville").closest("div")?.className).not.toContain("hidden");
    expect(screen.getByText("12 logements trouves")).toBeTruthy();
  });
});
