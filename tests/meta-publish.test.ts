import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdvertisementStatus } from "@prisma/client";

const {
  advertisementFindUnique,
  advertisementPublicationFindFirst,
  advertisementPublicationFindUnique,
  advertisementUpdate,
  advertisementPublicationCreate,
  advertisementPublicationUpdate,
  metaConnectionFindUnique,
  transactionMock,
  decryptMetaToken,
} = vi.hoisted(() => ({
  advertisementFindUnique: vi.fn(),
  advertisementPublicationFindFirst: vi.fn(),
  advertisementPublicationFindUnique: vi.fn(),
  advertisementUpdate: vi.fn(),
  advertisementPublicationCreate: vi.fn(),
  advertisementPublicationUpdate: vi.fn(),
  metaConnectionFindUnique: vi.fn(),
  transactionMock: vi.fn(),
  decryptMetaToken: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    advertisement: {
      findUnique: advertisementFindUnique,
      update: advertisementUpdate,
    },
    advertisementPublication: {
      findFirst: advertisementPublicationFindFirst,
      findUnique: advertisementPublicationFindUnique,
      create: advertisementPublicationCreate,
      update: advertisementPublicationUpdate,
    },
    metaConnection: {
      findUnique: metaConnectionFindUnique,
    },
    $transaction: transactionMock,
  },
}));

vi.mock("@/lib/meta-token-crypto", () => ({
  decryptMetaToken,
  encryptMetaToken: vi.fn((value: string) => `enc-${value}`),
}));

vi.mock("@/lib/env", () => ({
  env: {
    META_PAGE_ID: "page-1",
    META_PAGE_ACCESS_TOKEN: undefined,
    META_APP_ID: "app-1",
    META_APP_SECRET: "secret-1",
    META_REDIRECT_URI: "https://logements.nowis.store/api/integrations/meta/facebook/callback",
    META_TOKEN_ENCRYPTION_KEY: "enc-key",
    META_GRAPH_API_VERSION: "v20.0",
    NEXT_PUBLIC_APP_URL: "https://logements.nowis.store",
  },
  getMetaConfigIssues: vi.fn(() => []),
  isMetaConfigured: true,
}));

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function buildAd(photoUrls: string[]) {
  return {
    id: "ad-1",
    title: "Grand 4 1/2 moderne",
    body: "Texte interne",
    status: AdvertisementStatus.APPROVED,
    property: {
      id: "property-1",
      rentalUnitId: "unit-1",
      status: "AVAILABLE",
      monthlyPrice: 1800,
      bedrooms: 2,
      city: "Drummondville",
      district: "Centre",
      propertyType: "Appartement",
      petsAllowed: true,
      parking: true,
      inclusions: "Electros",
      photos: photoUrls.map((url, index) => ({ id: `p-${index}`, url })),
    },
    selectedPhotos: photoUrls.map((url, index) => ({
      propertyPhoto: { id: `p-${index}`, url },
      channel: "PAGE",
      excluded: false,
      isPrimary: index === 0,
      sortOrder: index,
    })),
    publications: [],
  };
}

describe("Meta publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://logements.nowis.store";
    process.env.META_DRY_RUN = "false";

    advertisementPublicationFindFirst.mockResolvedValue(null);
    advertisementPublicationFindUnique.mockResolvedValue(null);
    advertisementPublicationCreate.mockResolvedValue({ id: "pub-1", status: AdvertisementStatus.PUBLISHING });
    advertisementPublicationUpdate.mockResolvedValue({ id: "pub-1", status: AdvertisementStatus.PUBLISHED });
    advertisementUpdate.mockResolvedValue({ id: "ad-1" });
    metaConnectionFindUnique.mockResolvedValue({
      id: "conn-1",
      pageAccessTokenEncrypted: "enc-page",
      userAccessTokenEncrypted: null,
      pageName: "Simon Page",
      scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts"],
    });
    decryptMetaToken.mockReturnValue("page-token");

    transactionMock.mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return arg({
          advertisementPublication: { update: advertisementPublicationUpdate },
          advertisement: { update: advertisementUpdate },
        });
      }
      return arg;
    });
  });

  it("publishes text + link when no photo is available", async () => {
    advertisementFindUnique.mockResolvedValue(buildAd([]));

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({ id: "123_456" }),
    );

    const { publishAdvertisementToMetaPage } = await import("@/lib/meta-facebook");
    await publishAdvertisementToMetaPage({
      advertisementId: "ad-1",
      userId: "user-1",
      idempotencyKey: "idem-1",
    });

    const [feedUrl, feedInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(feedUrl).toContain("/page-1/feed");
    const body = String(feedInit.body);
    expect(body).toContain("logements.nowis.store%2Flogements%2Funit-1");
    expect(body).toContain("Telephone%3A+819-388-3407");
    expect(body).toContain("Courriel%3A+simonmorin%40nowis.store");
  });

  it("publishes a single photo with message", async () => {
    advertisementFindUnique.mockResolvedValue(buildAd(["https://cdn.example.com/1.jpg"]));

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ post_id: "321_654" }));

    const { publishAdvertisementToMetaPage } = await import("@/lib/meta-facebook");
    await publishAdvertisementToMetaPage({
      advertisementId: "ad-1",
      userId: "user-1",
      idempotencyKey: "idem-2",
    });

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/page-1/photos");
  });

  it("publishes multiple photos using attached media", async () => {
    advertisementFindUnique.mockResolvedValue(buildAd([
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/2.jpg",
    ]));

    const fetchSpy = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ id: "media-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "media-2" }))
      .mockResolvedValueOnce(jsonResponse({ id: "post-789" }));

    const { publishAdvertisementToMetaPage } = await import("@/lib/meta-facebook");
    await publishAdvertisementToMetaPage({
      advertisementId: "ad-1",
      userId: "user-1",
      idempotencyKey: "idem-3",
    });

    expect((fetchSpy.mock.calls[0] as [string])[0]).toContain("/photos");
    expect((fetchSpy.mock.calls[1] as [string])[0]).toContain("/photos");
    expect((fetchSpy.mock.calls[2] as [string])[0]).toContain("/feed");
  });

  it("falls back to text + link when one photo fails", async () => {
    advertisementFindUnique.mockResolvedValue(buildAd([
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/2.jpg",
    ]));

    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Photo refused", code: 100 } }, false, 400))
      .mockResolvedValueOnce(jsonResponse({ id: "fallback-post" }));

    const { publishAdvertisementToMetaPage } = await import("@/lib/meta-facebook");
    const result = await publishAdvertisementToMetaPage({
      advertisementId: "ad-1",
      userId: "user-1",
      idempotencyKey: "idem-4",
    });

    expect(result.status).toBe(AdvertisementStatus.PUBLISHED);
    expect(advertisementPublicationUpdate).toHaveBeenCalled();
  });

  it("is idempotent when publication already exists", async () => {
    advertisementFindUnique.mockResolvedValue(buildAd([]));
    advertisementPublicationFindUnique.mockResolvedValue({ id: "pub-existing", externalId: "already-published" });

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ id: "unused" }));

    const { publishAdvertisementToMetaPage } = await import("@/lib/meta-facebook");
    const result = await publishAdvertisementToMetaPage({
      advertisementId: "ad-1",
      userId: "user-1",
      idempotencyKey: "idem-5",
    });

    expect(result.externalId).toBe("already-published");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses publication when the listing is unavailable", async () => {
    const ad = buildAd([]);
    ad.property.status = "RENTED";
    advertisementFindUnique.mockResolvedValue(ad);

    const { publishAdvertisementToMetaPage } = await import("@/lib/meta-facebook");

    await expect(() =>
      publishAdvertisementToMetaPage({
        advertisementId: "ad-1",
        userId: "user-1",
        idempotencyKey: "idem-6",
      }),
    ).rejects.toThrow("Le logement n'est plus disponible pour publication");
  });
});
