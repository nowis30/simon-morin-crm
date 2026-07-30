// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublicMobileMenu } from "@/components/public/public-mobile-menu";
import { PublicBottomNav } from "@/components/public/public-bottom-nav";

const pathnameMock = vi.fn(() => "/logements");

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

describe("public mobile navigation", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("opens and closes mobile menu with click and Escape", () => {
    render(
      <PublicMobileMenu
        phoneTechnical="+18193883407"
        links={[
          { href: "/", label: "Accueil" },
          { href: "/logements", label: "Logements" },
          { href: "/contact", label: "Contact" },
          { href: "tel:+18193883407", label: "Appeler Simon" },
        ]}
      />,
    );

    const menuButton = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menuButton);

    expect(screen.getByText("Navigation")).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Navigation")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  it("renders bottom nav and marks the active page", () => {
    pathnameMock.mockReturnValue("/logements/abc");
    render(<PublicBottomNav />);

    expect(screen.getByRole("navigation", { name: "Navigation mobile" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Logements" }).getAttribute("aria-current")).toBe("page");
  });
});
