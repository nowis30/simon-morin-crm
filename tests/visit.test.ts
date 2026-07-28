import { describe, expect, it } from "vitest";
import { createVisitWindow, visitApprovalStatus } from "@/lib/match-score";

describe("visit workflow", () => {
  it("cree une visite de 30 min avec tampon de 30 min", () => {
    const result = createVisitWindow("2026-08-15T18:30:00.000Z");
    expect(result.bufferMinutes).toBe(30);
    expect(result.endsAt.getTime() - result.startsAt.getTime()).toBe(30 * 60 * 1000);
  });

  it("approuve ou refuse selon la decision", () => {
    expect(visitApprovalStatus(true)).toBe("CONFIRMED");
    expect(visitApprovalStatus(false)).toBe("REFUSED");
  });
});
