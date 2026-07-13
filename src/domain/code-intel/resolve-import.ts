/**
 * Resolves a module specifier from an importing file into ordered candidate
 * repo-relative file paths to probe. Handles relative imports and tsconfig path
 * aliases; bare/external modules (node_modules) return [] and are not resolved.
 */

import { dirname, extname, joinAndNormalize } from "./path";

export interface AliasConfig {
  baseUrl: string;
  paths: Record<string, string[]>;
}

export const DEFAULT_ALIAS: AliasConfig = {
  baseUrl: ".",
  paths: { "@/*": ["src/*", "./*"] },
};

const RESOLVE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
  ".d.ts",
];

function applyAliases(specifier: string, alias: AliasConfig): string[] {
  const out: string[] = [];
  for (const [pattern, targets] of Object.entries(alias.paths)) {
    if (pattern.endsWith("/*")) {
      const base = pattern.slice(0, -2);
      if (specifier === base || specifier.startsWith(base + "/")) {
        const rest = specifier.slice(base.length).replace(/^\//, "");
        for (const target of targets) {
          const mapped = target.replace(/\*$/, "").replace(/\/$/, "");
          out.push(joinAndNormalize(alias.baseUrl, `${mapped}/${rest}`));
        }
      }
    } else if (specifier === pattern) {
      for (const target of targets) {
        out.push(joinAndNormalize(alias.baseUrl, target));
      }
    }
  }
  return out;
}

function expandCandidates(base: string): string[] {
  const candidates: string[] = [];
  if (extname(base)) candidates.push(base);
  for (const ext of RESOLVE_EXTENSIONS) candidates.push(`${base}${ext}`);
  for (const ext of RESOLVE_EXTENSIONS) candidates.push(`${base}/index${ext}`);
  return [...new Set(candidates)];
}

/** True for true node_modules packages: "react", "zod", "@scope/pkg". */
export function isBarePackage(specifier: string): boolean {
  if (specifier.startsWith(".")) return false;
  if (specifier.startsWith("@")) return /^@[^/]+\/[^/]+$/.test(specifier);
  return !specifier.includes("/");
}

export function resolveImportCandidates(
  importerPath: string,
  specifier: string,
  alias: AliasConfig = DEFAULT_ALIAS,
): string[] {
  if (specifier.startsWith(".")) {
    const base = joinAndNormalize(dirname(importerPath), specifier);
    return expandCandidates(base);
  }

  // A real package — not resolvable to a repo file.
  if (isBarePackage(specifier)) return [];

  // Non-relative repo imports: try tsconfig `paths` aliases, then resolve
  // against `baseUrl` (e.g. "interfaces/types" -> "<baseUrl>/interfaces/types").
  const candidates: string[] = [];
  for (const aliased of applyAliases(specifier, alias)) {
    candidates.push(...expandCandidates(aliased));
  }
  candidates.push(...expandCandidates(joinAndNormalize(alias.baseUrl, specifier)));
  return [...new Set(candidates)];
}

export function aliasFromTsconfig(tsconfig: unknown): AliasConfig {
  const co =
    (tsconfig as { compilerOptions?: Record<string, unknown> } | null)
      ?.compilerOptions ?? {};
  const baseUrl = typeof co.baseUrl === "string" ? co.baseUrl : ".";
  const paths =
    co.paths && typeof co.paths === "object"
      ? (co.paths as Record<string, string[]>)
      : DEFAULT_ALIAS.paths;
  return { baseUrl: baseUrl.replace(/^\.\//, "").replace(/\/$/, "") || ".", paths };
}
