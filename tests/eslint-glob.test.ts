import { createRequire } from "node:module";
import { resolve } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const requireFromTest = createRequire(import.meta.url);
const { getRootDirs } = requireFromTest("@next/eslint-plugin-next/dist/utils/get-root-dirs.js") as {
  getRootDirs: (context: { cwd: string; settings: { next?: { rootDir: string | string[] } } }) => string[];
};
const normalize = (paths: string[]) => paths.map((path) => resolve(path)).sort();

// Next 16.3.8 only uses globSync(pattern, { onlyDirectories: true }).
// The scoped npm override removes the unpatched braces chain; these tests exercise
// the actual Next plugin so a future incompatible API change fails CI.
describe("Next ESLint glob replacement", () => {
  it("resolves brace patterns and excludes files", () => {
    const actual = getRootDirs({
      cwd: process.cwd(),
      settings: { next: { rootDir: "src/{app,components,proxy.ts}" } },
    });
    expect(normalize(actual)).toEqual(normalize(["src/app", "src/components"]));
  });

  it("handles arrays, Windows separators, and unmatched patterns", () => {
    const actual = getRootDirs({
      cwd: process.cwd(),
      settings: { next: { rootDir: ["src\\components", "src/lib", "__missing_next_root__/*"] } },
    });
    expect(normalize(actual)).toEqual(normalize(["src/components", "src/lib"]));
    expect(getRootDirs({ cwd: process.cwd(), settings: {} })).toEqual([process.cwd()]);
  });

  it("handles deeply nested brace patterns without exhausting the stack", () => {
    const pattern = `src/${"{".repeat(6000)}app${"}".repeat(6000)}`;
    expect(() => getRootDirs({
      cwd: process.cwd(),
      settings: { next: { rootDir: pattern } },
    })).not.toThrow();
  });

  it("still reports Next and TypeScript lint errors", async () => {
    const eslint = new ESLint({
      overrideConfig: { settings: { next: { rootDir: "." } } },
    });
    const [result] = await eslint.lintText(
      'export default function Example() { const unused = 1; return <script src="/unsafe.js" />; }',
      { filePath: "src/app/lint-regression.tsx" },
    );
    expect(result.messages.map((message) => message.ruleId)).toContain("@next/next/no-sync-scripts");
    expect(result.messages.map((message) => message.ruleId)).toContain("@typescript-eslint/no-unused-vars");
  }, 20_000);
});
