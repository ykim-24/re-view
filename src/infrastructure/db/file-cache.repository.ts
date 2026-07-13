import "server-only";

/**
 * Persistent cache for file content fetched at an immutable commit sha. Content
 * at a 40-char sha never changes (and a 404 there is permanent too), so a row —
 * including one with NULL content — is a definitive answer and saves a GitHub
 * request. Refs that aren't full shas (branch names, tags) are never cached.
 */

import { getDb } from "./client";

const SHA_RE = /^[0-9a-f]{40}$/;

export function isImmutableRef(ref: string): boolean {
  return SHA_RE.test(ref);
}

export interface CachedFile {
  content: string | null;
}

export function getCachedFile(
  repoKey: string,
  ref: string,
  path: string,
): CachedFile | null {
  const row = getDb()
    .prepare(
      "SELECT content FROM file_cache WHERE repo_key = ? AND ref = ? AND path = ?",
    )
    .get(repoKey, ref, path) as { content: string | null } | undefined;
  if (!row) return null;
  return { content: row.content };
}

export function setCachedFile(
  repoKey: string,
  ref: string,
  path: string,
  content: string | null,
): void {
  getDb()
    .prepare(
      `INSERT INTO file_cache (repo_key, ref, path, content, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(repo_key, ref, path)
       DO UPDATE SET content = excluded.content, fetched_at = excluded.fetched_at`,
    )
    .run(repoKey, ref, path, content, new Date().toISOString());
}
