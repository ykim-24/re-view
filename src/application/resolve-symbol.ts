/**
 * Go-to-definition use-case. Given a symbol clicked in `importerPath`, finds
 * where it's defined: a local declaration in the same file, or — by following
 * the import that introduces it — the export in its source file. Returns the
 * defining file's content and 1-based line, or a reason it couldn't resolve
 * (external package or unresolved specifier).
 */

import "server-only";
import { getFileContent } from "@/infrastructure/github/pull-request.repository";
import { repoKey } from "@/lib/pr-key";
import {
  getRepoIndexMeta,
  lookupDefinitions,
} from "@/infrastructure/db/code-index.repository";
import { loadAlias } from "./load-alias";
import { findBindingForName, parseImports } from "@/domain/code-intel/parse-imports";
import { resolveImportCandidates } from "@/domain/code-intel/resolve-import";
import {
  definitionEndLine,
  findDefinition,
  indexSymbols,
} from "@/domain/code-intel/symbol-index";

export interface ResolveSymbolInput {
  owner: string;
  repo: string;
  ref: string;
  importerPath: string;
  symbol: string;
}

export type ResolveKind = "import" | "local" | "external" | "unresolved";

export interface ResolveSymbolResult {
  kind: ResolveKind;
  path?: string;
  line?: number;
  endLine?: number;
  content?: string;
  specifier?: string;
  message?: string;
}

/**
 * Last resort: consult the repo-wide index for an exported symbol the import
 * graph couldn't reach, and load its file at the indexed commit.
 */
async function resolveFromIndex(
  owner: string,
  repo: string,
  symbol: string,
): Promise<ResolveSymbolResult | null> {
  const key = repoKey({ owner, repo });
  const meta = getRepoIndexMeta(key);
  if (!meta || meta.status !== "ready") return null;

  const hits = lookupDefinitions(key, symbol);
  if (hits.length === 0) return null;

  const hit = hits[0];
  const content = await getFileContent(owner, repo, hit.path, meta.headSha);
  if (content === null) return null;

  return {
    kind: "import",
    path: hit.path,
    line: hit.line,
    endLine: hit.endLine,
    content,
  };
}

export async function resolveSymbol(
  input: ResolveSymbolInput,
): Promise<ResolveSymbolResult> {
  const { owner, repo, ref, importerPath, symbol } = input;

  const importerContent = await getFileContent(owner, repo, importerPath, ref);
  if (importerContent === null) {
    return { kind: "unresolved", message: "Could not read the source file." };
  }

  const imports = parseImports(importerContent);
  const binding = findBindingForName(imports, symbol);

  if (!binding) {
    const local = findDefinition(indexSymbols(importerContent), symbol);
    if (local) {
      return {
        kind: "local",
        path: importerPath,
        line: local.line,
        endLine: definitionEndLine(importerContent, local.line),
        content: importerContent,
      };
    }
    const indexed = await resolveFromIndex(owner, repo, symbol);
    if (indexed) return indexed;
    return {
      kind: "unresolved",
      message: `No local declaration or import found for "${symbol}".`,
    };
  }

  const alias = await loadAlias(owner, repo, ref);
  const candidates = resolveImportCandidates(importerPath, binding.source, alias);

  if (candidates.length === 0) {
    return {
      kind: "external",
      specifier: binding.source,
      message: `"${symbol}" comes from the external module "${binding.source}".`,
    };
  }

  for (const candidate of candidates) {
    const content = await getFileContent(owner, repo, candidate, ref);
    if (content === null) continue;

    const wanted = binding.binding.imported;
    const def = wanted === "*" ? null : findDefinition(indexSymbols(content), wanted);
    const line = def?.line ?? 1;

    return {
      kind: "import",
      path: candidate,
      line,
      endLine: def ? definitionEndLine(content, line) : line,
      content,
      specifier: binding.source,
    };
  }

  const indexed = await resolveFromIndex(owner, repo, symbol);
  if (indexed) return { ...indexed, specifier: binding.source };

  return {
    kind: "unresolved",
    specifier: binding.source,
    message: `Could not locate the file for "${binding.source}".`,
  };
}
