import "server-only";

/**
 * Shared gathering of code context for a set of changed files: each file's full
 * current content (budgeted) and the definitions of symbols the diff references,
 * resolved through the repo-wide symbol index. Used by both the auto review and
 * the diff summary so they see the same grounded context.
 */

import { getFileContent } from "@/infrastructure/github/pull-request.repository";
import { repoKey } from "@/lib/pr-key";
import {
  getRepoIndexMeta,
  lookupDefinitions,
} from "@/infrastructure/db/code-index.repository";
import type { FileChange } from "@/domain/pull-request/models";

export type Log = (message: string) => void;

const MAX_FILES = 15;
const PER_FILE_CHARS = 8000;
const FILE_BUDGET = 90000;
const MAX_IDENTIFIERS = 24;
const MAX_DEFS = 10;
const DEF_BUDGET = 40000;
const DEF_SNIPPET_LINES = 60;

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "import", "export", "from", "type", "interface", "class", "new", "await",
  "async", "this", "true", "false", "null", "undefined", "void", "string",
  "number", "boolean", "extends", "implements", "readonly", "static", "default",
  "switch", "case", "break", "continue", "throw", "try", "catch", "finally",
  "typeof", "instanceof", "enum", "namespace", "super", "yield", "delete",
]);

export interface FileBody {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
  content?: string;
}

export interface RelatedDefinition {
  name: string;
  path: string;
  line: number;
  snippet: string;
}

function extractIdentifiers(text: string): string[] {
  const matches = text.match(/[A-Za-z_$][\w$]*/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (m.length < 3 || KEYWORDS.has(m) || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

export async function gatherFileBodies(
  owner: string,
  repo: string,
  headSha: string,
  files: FileChange[],
  log: Log,
): Promise<FileBody[]> {
  const out: FileBody[] = [];
  let budget = FILE_BUDGET;
  for (const file of files.slice(0, MAX_FILES)) {
    const body: FileBody = {
      path: file.path,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch,
    };
    if (file.status !== "removed" && budget > 0) {
      const content = await getFileContent(owner, repo, file.path, headSha).catch(
        () => null,
      );
      if (content) {
        const slice = content.slice(0, Math.min(PER_FILE_CHARS, budget));
        body.content = slice;
        budget -= slice.length;
      }
    }
    log(`${file.path} (${file.status}, +${file.additions}/-${file.deletions})`);
    out.push(body);
  }
  if (files.length > MAX_FILES) {
    log(`(+${files.length - MAX_FILES} more files not shown)`);
  }
  return out;
}

export async function gatherDefinitions(
  owner: string,
  repo: string,
  files: FileChange[],
  log: Log,
): Promise<RelatedDefinition[]> {
  const key = repoKey({ owner, repo });
  const meta = getRepoIndexMeta(key);
  if (!meta || meta.status !== "ready") {
    log("Repo index not ready — skipping cross-file definitions");
    return [];
  }

  const changedPaths = new Set(files.map((f) => f.path));
  const names = extractIdentifiers(
    files.map((f) => f.patch ?? "").join("\n"),
  ).slice(0, MAX_IDENTIFIERS);

  const related: RelatedDefinition[] = [];
  const seen = new Set<string>();
  let budget = DEF_BUDGET;
  for (const name of names) {
    if (related.length >= MAX_DEFS || budget <= 0) break;
    const hit = lookupDefinitions(key, name)[0];
    if (!hit || changedPaths.has(hit.path)) continue;
    const dedupeKey = `${hit.path}:${hit.line}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const content = await getFileContent(owner, repo, hit.path, meta.headSha).catch(
      () => null,
    );
    if (!content) continue;
    const lines = content.split("\n");
    const end = Math.min(lines.length, hit.line + DEF_SNIPPET_LINES);
    const snippet = lines.slice(hit.line - 1, end).join("\n").slice(0, budget);
    budget -= snippet.length;
    related.push({ name, path: hit.path, line: hit.line, snippet });
    log(`Resolved \`${name}\` → ${hit.path}:${hit.line}`);
  }
  if (related.length === 0) log("No cross-file definitions resolved");
  return related;
}
