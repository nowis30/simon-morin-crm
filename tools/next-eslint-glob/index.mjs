import { globSync as find } from "tinyglobby";

// Next's only fast-glob call searches for root directories. Tinyglobby expands
// directory matches by default; fast-glob does not. Preserve the latter here.
export const globSync = (patterns, options) =>
  find(patterns, { ...options, expandDirectories: false });
