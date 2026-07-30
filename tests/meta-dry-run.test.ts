import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdvertisementStatus } from "@prisma/client";

const { advertisementFindUnique, advertisementPublicationFindFirst, advertisementPublicationFindUnique, advertisementUpdate, advertisementPublicationCreate, advertisementPublicationUpdate } = vi.hoisted(() => ({
  advertisementFindUnique: vi.fn(),
  advertisementPublicationFindFirst: vi.fn(),
  advertisementPublicationFindUnique: vi.fn(),
  advertisementUpdate: vi.fn(),
  advertisementPublicationCreate: vi.fn(),
  advertisementPublicationUpdate: vi.fn(),
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
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(async (callback) => (typeof callback === "function" ? callback({
      advertisement: { update: advertisementUpdate },
      advertisementPublication: { update: advertisementPublicationUpdate },
    }) : callback)),
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    META_PAGE_ID: "page-1",
    META_PAGE_ACCESS_TOKEN: "page-token",
    META_GRAPH_API_VERSION: "v20.0",
    NEXT_PUBLIC_APP_URL: "https://logements.nowis.store",
  },
  getMetaConfigIssues: vi.fn(() => []),
  isMetaConfigured: true,
}));

import { publishAdvertisementToMetaPage } from "@/lib/meta-facebook";

describe("publishAdvertisementToMetaPage dry run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_DRY_RUN = "true";
    advertisementFindUnique.mockResolvedValue({
      id: "ad-1",
      title: "Belle maison",
      body: "Description",
      status: AdvertisementStatus.APPROVED,
      property: {
        id: "property-1",
        rentalUnitId: "unit-1",
        status: "AVAILABLE",
        city: "Drummondville",
        district: "Centre",
        monthlyPrice: 1800,
        bedrooms: 2,
        propertyType: "Appartement",
        petsAllowed: true,
        parking: true,
        inclusions: "Electros",
        photos: [{ url: "https://example.com/photo-1.jpg" }],
      },
      selectedPhotos: [],
      publications: [],
    });
    advertisementPublicationFindFirst.mockResolvedValue(null);
    advertisementPublicationFindUnique.mockResolvedValue(null);
    advertisementPublicationCreate.mockResolvedValue({ id: "pub-1" });
    process.env.META_PAGE_ACCESS_TOKEN = "page-token";
  });

  it("skips the live Facebook call when dry run is enabled", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ id: "fake-id" }),
    } as Response);

    const result = await publishAdvertisementToMetaPage({
      advertisementId: "ad-1",
      userId: "user-1",
      idempotencyKey: "key-1",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: "pub-1" });
  });
});
