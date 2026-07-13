/**
 * Loads a repo's import-path aliases from its tsconfig/jsconfig at a ref so the
 * resolver can map specifiers like "@/lib/foo". Tolerates JSONC (comments,
 * trailing commas) and falls back to sensible defaults when absent or malformed.
 * Results are cached per owner/repo/ref.
 */

import "server-only";
import { getFileContent } from "@/infrastructure/github/pull-request.repository";
import {
  aliasFromTsconfig,
  DEFAULT_ALIAS,
  type AliasConfig,
} from "@/domain/code-intel/resolve-import";

function stripJsonComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/,(\s*[}\]])/g, "$1");
}

const cache = new Map<string, AliasConfig>();

export async function loadAlias(
  owner: string,
  repo: string,
  ref: string,
): Promise<AliasConfig> {
  const key = `${owner}/${repo}@${ref}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let alias: AliasConfig = DEFAULT_ALIAS;
  for (const path of ["tsconfig.json", "jsconfig.json"]) {
    const raw = await getFileContent(owner, repo, path, ref);
    if (!raw) continue;
    try {
      alias = aliasFromTsconfig(JSON.parse(stripJsonComments(raw)));
      break;
    } catch {
      void 0;
    }
  }

  cache.set(key, alias);
  return alias;
}
