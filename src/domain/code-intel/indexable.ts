/**
 * Decides which repo files are worth indexing for go-to-definition. TS/JS source
 * only (the heuristic indexer's language), excluding minified bundles. Vendored
 * directories like node_modules aren't committed, so the git tree already omits
 * them; this is a belt-and-suspenders guard plus a build-output skip.
 */

const CODE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
];

const SKIP_SEGMENTS = ["node_modules/", "/dist/", "/build/", "/.next/"];

export function isIndexablePath(path: string): boolean {
  if (path.endsWith(".min.js")) return false;
  if (SKIP_SEGMENTS.some((seg) => path.includes(seg))) return false;
  if (path.startsWith("dist/") || path.startsWith("build/")) return false;
  return CODE_EXTENSIONS.some((ext) => path.endsWith(ext));
}
