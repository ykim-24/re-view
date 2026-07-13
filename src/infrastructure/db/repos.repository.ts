import "server-only";
import { getDb } from "./client";
import type { SavedRepo } from "@/domain/pull-request/models";

interface Row {
  owner: string;
  repo: string;
  last_opened_at: string;
}

export function repoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

export function listSavedRepos(): SavedRepo[] {
  const rows = getDb()
    .prepare(`SELECT * FROM saved_repo ORDER BY last_opened_at DESC`)
    .all() as Row[];
  return rows.map((r) => ({
    owner: r.owner,
    repo: r.repo,
    lastOpenedAt: r.last_opened_at,
  }));
}

export function saveRepo(owner: string, repo: string): void {
  getDb()
    .prepare(
      `INSERT INTO saved_repo (key, owner, repo, last_opened_at)
       VALUES (@key, @owner, @repo, @now)
       ON CONFLICT(key) DO UPDATE SET last_opened_at = excluded.last_opened_at`,
    )
    .run({
      key: repoKey(owner, repo),
      owner,
      repo,
      now: new Date().toISOString(),
    });
}

export function removeRepo(key: string): void {
  getDb().prepare(`DELETE FROM saved_repo WHERE key = ?`).run(key);
}
