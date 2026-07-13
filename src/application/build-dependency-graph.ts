import "server-only";
import { getFileContent } from "@/infrastructure/github/pull-request.repository";
import { loadAlias } from "./load-alias";
import { parseImports } from "@/domain/code-intel/parse-imports";
import { resolveImportCandidates } from "@/domain/code-intel/resolve-import";
import { symbolsUsedInPatch } from "@/domain/code-intel/patch";
import { isCodeIntelPath } from "@/lib/language";
import {
  buildGraph,
  type ChangedFileDeps,
  type DependencyGraph,
  type ResolvedDependency,
} from "@/domain/dependency-graph/build-graph";

export interface ChangedFileInput {
  path: string;
  /** unified-diff patch for this file, used to find symbols touched by the PR */
  patch?: string;
}

export interface BuildGraphInput {
  owner: string;
  repo: string;
  ref: string;
  /** files changed in the PR, with their diff patches */
  files: ChangedFileInput[];
}

/**
 * Build the changed-files-plus-direct-imports graph. For each changed TS/JS
 * file we parse its imports, resolve each specifier to candidate paths, and
 * probe GitHub for the first candidate that actually exists (1 hop, forward).
 */
export async function buildDependencyGraph(
  input: BuildGraphInput,
): Promise<DependencyGraph> {
  const { owner, repo, ref, files } = input;
  const changedSet = new Set(files.map((f) => f.path));
  const patchByPath = new Map(files.map((f) => [f.path, f.patch]));
  const alias = await loadAlias(owner, repo, ref);

  const probeCache = new Map<string, string | null>();
  const probe = async (path: string): Promise<boolean> => {
    if (!probeCache.has(path)) {
      probeCache.set(path, await getFileContent(owner, repo, path, ref));
    }
    return probeCache.get(path) !== null;
  };

  const codeFiles = files.filter((f) => isCodeIntelPath(f.path));

  const fileDeps: ChangedFileDeps[] = await Promise.all(
    codeFiles.map(async ({ path }) => {
      const content = await getFileContent(owner, repo, path, ref);
      if (content === null) return { path, deps: [], unresolved: [] };

      const patch = patchByPath.get(path);
      const deps: ResolvedDependency[] = [];
      const unresolved: string[] = [];

      for (const imp of parseImports(content)) {
        const candidates = resolveImportCandidates(path, imp.source, alias);
        if (candidates.length === 0) {
          unresolved.push(imp.source);
          continue;
        }
        let resolved: string | null = null;
        for (const candidate of candidates) {
          if (await probe(candidate)) {
            resolved = candidate;
            break;
          }
        }
        if (resolved) {
          const symbols = imp.bindings.map((b) => b.local);
          deps.push({
            to: resolved,
            specifier: imp.source,
            symbols,
            usedSymbols: symbolsUsedInPatch(patch, symbols),
            changed: changedSet.has(resolved),
          });
        } else {
          unresolved.push(imp.source);
        }
      }

      return { path, deps, unresolved };
    }),
  );

  return buildGraph(fileDeps);
}
