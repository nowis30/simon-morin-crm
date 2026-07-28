import { PropertyStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildSyncComparisonReport, buildSyncSnapshot, getCodesToFlagAsVerify } from "@/lib/gestion-isr-sync";

describe("gestion-isr sync report", () => {
  it("fait passer un logement absent au statut a verifier via la liste de codes", () => {
    const missing = getCodesToFlagAsVerify(["ISR-001", "ISR-002"], ["ISR-001"]);
    expect(missing).toEqual(["ISR-002"]);
  });

  it("construit un rapport comparatif", () => {
    const previous = buildSyncSnapshot([
      { id: "1", codeIsr: "ISR-001", address: "123 Rue A", status: PropertyStatus.AVAILABLE, gestionIsrUrl: "https://location.gestion-isr.com/", photos: [{ url: "a.jpg" }] },
      { id: "2", codeIsr: "ISR-002", address: "456 Rue B", status: PropertyStatus.AVAILABLE, gestionIsrUrl: "https://location.gestion-isr.com/", photos: [{ url: "b.jpg" }] },
    ]);

    const report = buildSyncComparisonReport(
      [
        { id: "1", codeIsr: "ISR-001", address: "123 Rue A mod", status: PropertyStatus.TO_VERIFY, gestionIsrUrl: "https://location.gestion-isr.com/", photos: [{ url: "a2.jpg" }] },
        { id: "3", codeIsr: "ISR-003", address: "789 Rue C", status: PropertyStatus.AVAILABLE, gestionIsrUrl: "https://location.gestion-isr.com/", photos: [{ url: "c.jpg" }] },
      ],
      previous,
    );

    expect(report.missingNow).toEqual(["ISR-002"]);
    expect(report.newProperties).toEqual(["ISR-003"]);
    expect(report.changedAddresses).toEqual(["ISR-001"]);
    expect(report.changedPhotos).toEqual(["ISR-001"]);
    expect(report.toVerifyProperties).toBe(1);
  });
});
