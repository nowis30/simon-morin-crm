import { describe, expect, it } from "vitest";
import { metadata as privateMetadata } from "@/app/(private)/layout";

describe("private metadata", () => {
  it("marks private pages as noindex", () => {
    expect(privateMetadata.robots).toMatchObject({
      index: false,
      follow: false,
    });
  });
});
