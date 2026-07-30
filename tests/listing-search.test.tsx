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
});
