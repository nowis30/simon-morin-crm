# ESLint dependency override

`@next/eslint-plugin-next@16.3.8` depends on `fast-glob`, which pulls in
`micromatch` and `braces@3.0.3`. As of 2026-10-20, the published `braces` releases
have no fix for [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

The package override replaces **only the Next ESLint plugin's** `fast-glob`
dependency with the local adapter `tools/next-eslint-glob`, using the registry
package `tinyglobby@0.2.17`. The plugin uses only
`globSync(pattern, { onlyDirectories: true })`. The adapter disables tinyglobby's
automatic directory expansion to preserve fast-glob's matching behavior.
The vulnerable parser and its dependency chain are removed from the lockfile;
no audit advisory is suppressed and no ESLint rules are disabled.

The override's `file:../../../tools/next-eslint-glob` path is relative to
`node_modules/@next/eslint-plugin-next`, as resolved by npm for this nested
override. The lockfile records the repository-relative `tools/next-eslint-glob`
link. Keep the adapter directory in the checkout before running `npm ci`.

`tests/eslint-glob.test.ts` exercises the actual installed plugin with brace
patterns, directory filtering, Windows separators, arrays, deep nesting, and
intentional lint violations. Run these tests when upgrading Next's ESLint plugin.
Remove the override once its upstream dependency no longer uses the affected
parser and both the tests and `npm audit` pass.
