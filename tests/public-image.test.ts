import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { fetchPublicImage, isPublicAddress } from "@/lib/public-image";

beforeEach(() => vi.resetAllMocks());
describe("public image network access", () => {
  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.0.1", "100.64.0.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2002:7f00:1::"])("rejects private address %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it("rejects a public hostname that resolves to a private address", async () => {
    mocks.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(fetchPublicImage("https://photos.example.com/a.jpg", 100, 1000)).rejects.toThrow("privée");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("pins the validated address in the connection and bounds the body", async () => {
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200, headers: { "content-type": "image/jpeg" },
      destroy: vi.fn((error) => response.emit("error", error)),
    });
    mocks.request.mockImplementation((_url, options, callback) => {
      const resolved = vi.fn();
      options.lookup("photos.example.com", {}, resolved);
      expect(resolved).toHaveBeenCalledWith(null, "8.8.8.8", 4);
      expect(options.agent).toBe(false);
      return Object.assign(new EventEmitter(), { end: () => {
        callback(response);
        response.emit("data", Buffer.alloc(101));
      } });
    });
    await expect(fetchPublicImage("https://photos.example.com/a.jpg", 100, 1000)).rejects.toThrow("volumineuse");
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
    expect(response.destroy).toHaveBeenCalledOnce();
  });
});
