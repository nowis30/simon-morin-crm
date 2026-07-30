import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, auditMock } = vi.hoisted(() => ({
  prismaMock: {
    prospect: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    prospectInteraction: { findFirst: vi.fn(), create: vi.fn() },
  },
  auditMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: auditMock }));

describe("public contact API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.prospect.findFirst.mockResolvedValue(null);
    prismaMock.prospect.create.mockResolvedValue({ id: "prospect-1" });
    prismaMock.prospectInteraction.findFirst.mockResolvedValue(null);
    prismaMock.prospectInteraction.create.mockResolvedValue({ id: "interaction-1" });
  });

  it("accepts valid payload and creates prospect interaction without visit", async () => {
    const { POST } = await import("@/app/api/public/contact/route");
    const response = await POST(
      new Request("http://localhost/api/public/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "Alice Martin",
          phone: "819-555-0101",
          email: "alice@example.com",
          preferredContactMethod: "EMAIL",
          message: "Je veux plus d'informations sur vos services.",
          consent: true,
          honeypot: "",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(prismaMock.prospect.create).toHaveBeenCalled();
    expect(prismaMock.prospectInteraction.create).toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalled();
  });

  it("ignores honeypot spam payload", async () => {
    const { POST } = await import("@/app/api/public/contact/route");
    const response = await POST(
      new Request("http://localhost/api/public/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "Bot",
          phone: "8195550000",
          email: "bot@example.com",
          preferredContactMethod: "PHONE",
          message: "Spam message test",
          consent: true,
          honeypot: "filled",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(prismaMock.prospect.create).not.toHaveBeenCalled();
    expect(prismaMock.prospectInteraction.create).not.toHaveBeenCalled();
  });

  it("prevents duplicate interactions in short window", async () => {
    prismaMock.prospect.findFirst.mockResolvedValue({ id: "prospect-1", notes: "old" });
    prismaMock.prospect.update.mockResolvedValue({ id: "prospect-1" });
    prismaMock.prospectInteraction.findFirst.mockResolvedValue({ id: "existing" });

    const { POST } = await import("@/app/api/public/contact/route");
    const response = await POST(
      new Request("http://localhost/api/public/contact", {
        method: "POST",
        body: JSON.stringify({
          name: "Alice Martin",
          phone: "819-555-0101",
          email: "alice@example.com",
          preferredContactMethod: "PHONE",
          message: "Je veux plus d'informations sur vos services.",
          consent: true,
          honeypot: "",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.prospect.update).toHaveBeenCalled();
    expect(prismaMock.prospectInteraction.create).not.toHaveBeenCalled();
  });
});
