// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisitRequestForm } from "@/components/public/visit-request-form";

describe("public visit request form mobile", () => {
  it("uses mobile-friendly keyboard/input attributes and visible labels", () => {
    render(<VisitRequestForm propertyId="property-1" rentalUnitId="unit-1" />);

    expect(screen.getByLabelText("Nom complet").getAttribute("autocomplete")).toBe("name");
    expect(screen.getByLabelText("Telephone").getAttribute("inputmode")).toBe("tel");
    expect(screen.getByLabelText("Telephone").getAttribute("autocomplete")).toBe("tel");
    expect(screen.getByLabelText("Courriel").getAttribute("type")).toBe("email");
    expect(screen.getByLabelText("Courriel").getAttribute("inputmode")).toBe("email");
    expect(screen.getByLabelText("Chambres recherchees").getAttribute("inputmode")).toBe("numeric");
    expect(screen.getByRole("button", { name: "Envoyer la demande" })).toBeTruthy();
  });
});
