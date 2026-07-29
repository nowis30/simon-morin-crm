import { describe, expect, it, vi } from "vitest";
import {
  fetchGestionIsrListings,
  inferGestionIsrMetadata,
  normalizeGestionIsrSupabaseListings,
  normalizeGestionIsrUnitStatus,
  selectGestionIsrCodesToRemove,
} from "@/integrations/gestion-isr/importer";

describe("gestion-isr importer", () => {
  it("extrait des logements a partir d'une page HTML", async () => {
    const html = `
      <html><body>
        <article>
          <h3>Code ISR: abc-123 | 123 Rue Test</h3>
          <div class="price">1295$ / mois</div>
          <div class="location">Quebec, Limoilou</div>
          <div>2 chambres</div>
          <a href="/logement/abc-123">Voir</a>
          <img src="/img/photo1.jpg" />
        </article>
        <article>
          <h3>Code ISR: def-456 | 55 Avenue Demo</h3>
          <div class="price">1499$ / mois</div>
          <div class="location">Levis, Desjardins</div>
          <div>3 chambres</div>
          <a href="/logement/def-456">Voir</a>
          <img src="/img/photo2.jpg" />
        </article>
        <article>
          <h3>Code ISR: ghi-789 | 80 Boulevard Sample</h3>
          <div class="price">999$ / mois</div>
          <div class="location">Quebec, Sainte-Foy</div>
          <div>1 chambre</div>
          <a href="/logement/ghi-789">Voir</a>
          <img src="/img/photo3.jpg" />
        </article>
      </body></html>
    `;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(html, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    );

    const listings = await fetchGestionIsrListings("https://example.com/logements");

    expect(listings.length).toBe(3);
    expect(listings[0].codeIsr).toContain("ISR-");
    expect(listings[0].monthlyPrice).toBeGreaterThan(0);
    expect(listings[0].photoUrls[0]).toContain("https://example.com");
  });

  it("detecte les logements ISR a retirer lorsqu'ils ne sont plus sur la source", () => {
    const removed = selectGestionIsrCodesToRemove({
      sourceUrl: "https://example.com/logements",
      liveListings: [
        {
          codeIsr: "ISR-ABC-123",
          address: "123 Rue Test",
          city: "Quebec",
          monthlyPrice: 1295,
          bedrooms: 2,
          propertyType: "Appartement",
          descriptionFr: "desc",
          listingUrl: "https://example.com/logement/abc-123",
          photoUrls: [],
        },
      ],
      existingProperties: [
        {
          codeIsr: "ISR-ABC-123",
          gestionIsrUrl: "https://example.com/logement/abc-123",
          status: "TO_VERIFY",
        },
        {
          codeIsr: "ISR-OLD-999",
          gestionIsrUrl: "https://example.com/logement/old-999",
          status: "AVAILABLE",
        },
        {
          codeIsr: "ISR-RENTED-1",
          gestionIsrUrl: "https://example.com/logement/rented-1",
          status: "RENTED",
        },
        {
          codeIsr: "OTHER-HOST-1",
          gestionIsrUrl: "https://another-site.com/logement/1",
          status: "AVAILABLE",
        },
      ],
    });

    expect(removed).toEqual(["ISR-OLD-999"]);
  });

  it("developpe les unites disponibles Supabase en vrais logements", () => {
    const listings = normalizeGestionIsrSupabaseListings(
      [
        {
          id_app: "az194",
          titre: "4½ · Rue Lagace Drummondville",
          ville: "Drummondville",
          secteur: "Drummondville",
          grandeur: "4½",
          loyer: 1415,
          description: "Description immeuble",
          main_photo: "https://example.com/main.jpg",
          photos: ["https://example.com/1.jpg"],
          units: [
            {
              id: "u1",
              numero: "4832",
              prix: 1415,
              type: "4½",
              etage: "2e étage",
              statut: "Disponible",
              chambres: 2,
              stationnement: 2,
              caract: "Disponible dès maintenant\n🐾 Chat accepté\n🚗 2 Stationnements",
              carac: { rue: "Rue Lagace, Drummondville", animaux: "Chat accepté" },
            },
            {
              id: "u2",
              numero: "4830",
              prix: 1400,
              type: "5½",
              statut: "Loué",
            },
          ],
        },
      ],
      "https://location.gestion-isr.com/",
    );

    expect(listings).toHaveLength(1);
    expect(listings[0].address).toContain("#4832");
    expect(listings[0].monthlyPrice).toBe(1415);
    expect(listings[0].photoUrls[0]).toContain("example.com");
  });

  it("deduit animaux, stationnement et inclusions depuis la description", () => {
    const metadata = inferGestionIsrMetadata(
      "🐾 Chat accepté\n🚗 2 Stationnements\nThermopompe (Chauffage et climatisation)\nInternet inclus",
    );

    expect(metadata.petsAllowed).toBe(true);
    expect(metadata.parking).toBe(true);
    expect(metadata.inclusions).toContain("Thermopompe");
    expect(metadata.inclusions).toContain("Internet inclus");
  });

  it("normalise les statuts ISR en valeurs publiques et actions recommandées", () => {
    expect(normalizeGestionIsrUnitStatus("Disponible")).toMatchObject({
      normalizedStatus: "AVAILABLE",
      isPublishable: true,
      recommendedAction: "PUBLISH",
    });
    expect(normalizeGestionIsrUnitStatus("Loué")).toMatchObject({
      normalizedStatus: "RENTED",
      isPublishable: false,
      recommendedAction: "HIDE",
    });
    expect(normalizeGestionIsrUnitStatus("Visite prévue")).toMatchObject({
      normalizedStatus: "VISIT_SCHEDULED",
      isPublishable: false,
      recommendedAction: "HIDE_FROM_LIST",
    });
  });
});
