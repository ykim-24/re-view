import "server-only";

/**
 * Persists AI-generated diff summaries (PR or branch comparison), keyed by the
 * summary target and tagged with the head sha they reflect — so a saved summary
 * can be shown instantly and flagged stale when the head moves.
 */

import { getDb } from "./client";

export interface SummaryRow {
  key: string;
  kind: "pr" | "compare";
  owner: string;
  repo: string;
  headSha: string;
  content: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

interface SummaryDbRow {
  key: string;
  kind: "pr" | "compare";
  owner: string;
  repo: string;
  head_sha: string;
  content: string;
  model: string;
  created_at: string;
  updated_at: string;
}

export function getSummary(key: string): SummaryRow | null {
  const row = getDb()
    .prepare(`SELECT * FROM summary WHERE key = ?`)
    .get(key) as SummaryDbRow | undefined;
  if (!row) return null;
  return {
    key: row.key,
    kind: row.kind,
    owner: row.owner,
    repo: row.repo,
    headSha: row.head_sha,
    content: row.content,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function upsertSummary(row: {
  key: string;
  kind: "pr" | "compare";
  owner: string;
  repo: string;
  headSha: string;
  content: string;
  model: string;
}): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO summary
         (key, kind, owner, repo, head_sha, content, model, created_at, updated_at)
       VALUES
         (@key, @kind, @owner, @repo, @head_sha, @content, @model, @created_at, @updated_at)
       ON CONFLICT(key) DO UPDATE SET
         head_sha   = excluded.head_sha,
         content    = excluded.content,
         model      = excluded.model,
         updated_at = excluded.updated_at`,
    )
    .run({
      key: row.key,
      kind: row.kind,
      owner: row.owner,
      repo: row.repo,
      head_sha: row.headSha,
      content: row.content,
      model: row.model,
      created_at: now,
      updated_at: now,
    });
}
