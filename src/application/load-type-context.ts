import "server-only";
import { getFileContent } from "@/infrastructure/github/pull-request.repository";
import { loadAlias } from "./load-alias";
import { parseImports } from "@/domain/code-intel/parse-imports";
import { resolveImportCandidates } from "@/domain/code-intel/resolve-import";
import { isCodeIntelPath } from "@/lib/language";

export interface TypeLib {
  path: string;
  content: string;
}

export interface TypeContext {
  baseUrl: string;
  paths: Record<string, string[]>;
  libs: TypeLib[];
}

export interface LoadTypeContextInput {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

/**
 * Gathers what Monaco needs to type-check a file: the repo's tsconfig aliases
 * plus the source of each directly-imported in-repo file (1 hop). Feeding these
 * to the TS worker lets hovers resolve cross-file types instead of `any`.
 */
export async function loadTypeContext(
  input: LoadTypeContextInput,
): Promise<TypeContext> {
  const { owner, repo, ref, path } = input;
  const alias = await loadAlias(owner, repo, ref);
  const base: TypeContext = { baseUrl: alias.baseUrl, paths: alias.paths, libs: [] };

  const content = await getFileContent(owner, repo, path, ref);
  if (content === null) return base;

  const resolved = await Promise.all(
    parseImports(content).map(async (imp): Promise<TypeLib | null> => {
      const candidates = resolveImportCandidates(path, imp.source, alias);
      for (const candidate of candidates) {
        if (!isCodeIntelPath(candidate)) continue;
        const depContent = await getFileContent(owner, repo, candidate, ref);
        if (depContent !== null) return { path: candidate, content: depContent };
      }
      return null;
    }),
  );

  const byPath = new Map<string, TypeLib>();
  for (const lib of resolved) {
    if (lib && !byPath.has(lib.path)) byPath.set(lib.path, lib);
  }

  return { ...base, libs: [...byPath.values()] };
}
