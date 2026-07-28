import { describe, expect, it } from "vitest";
import { defaultCommissionAmount } from "@/lib/match-score";

describe("commission", () => {
  it("retourne 500$ par logement loue", () => {
    expect(defaultCommissionAmount()).toBe(500);
  });
});
