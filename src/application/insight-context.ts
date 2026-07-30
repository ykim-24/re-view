import "server-only";

/**
 * Resolving a referenced symbol to the definition that backs it — the shared
 * context-gathering step behind both the insight pipeline and the chat agent's
 * tools. Follows imports (and falls back to the repo symbol index) and returns
 * either a snippet of the definition or the whole defining file, plus a
 * human-readable log line describing what happened.
 */

import { resolveSymbol } from "./resolve-symbol";
import { windowFile } from "@/domain/insight/gather";

export interface RelatedDefinition {
  name: string;
  path: string;
  line: number;
  snippet: string;
}

export interface DefinitionTarget {
  owner: string;
  repo: string;
  ref: string;
}

export interface Resolution {
  def: RelatedDefinition | null;
  log: string;
}

const SNIPPET_LINES = 40;

export async function resolveDefinition(
  target: DefinitionTarget,
  importerPath: string,
  name: string,
  full: boolean,
): Promise<Resolution> {
  const res = await resolveSymbol({
    owner: target.owner,
    repo: target.repo,
    ref: target.ref,
    importerPath,
    symbol: name,
  }).catch(() => null);
  if (!res) return { def: null, log: `\`${name}\` → could not resolve` };
  if (res.kind === "external") {
    return { def: null, log: `\`${name}\` → external module ${res.specifier ?? ""}` };
  }
  if (res.kind === "unresolved" || !res.content || !res.path || !res.line) {
    return { def: null, log: `\`${name}\` → no definition found` };
  }
  if (res.path === importerPath) return { def: null, log: "" };
  let snippet: string;
  if (full) {
    snippet = windowFile(res.content, res.line, res.line);
  } else {
    const lines = res.content.split("\n");
    snippet = lines
      .slice(res.line - 1, Math.min(lines.length, res.line + SNIPPET_LINES))
      .join("\n");
  }
  return {
    def: { name, path: res.path, line: res.line, snippet },
    log: `Resolved \`${name}\` → ${res.path}:${res.line}`,
  };
}
