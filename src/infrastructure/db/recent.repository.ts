import "server-only";
import { getDb } from "./client";
import { prKey } from "@/lib/pr-key";
import type { DashboardPr } from "@/domain/pull-request/models";

interface Row {
  owner: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  state: string;
  updated_at: string;
}

const KEEP = 40;

function toDashboardPr(row: Row): DashboardPr {
  return {
    owner: row.owner,
    repo: row.repo,
    number: row.number,
    title: row.title,
    author: row.author,
    url: row.url,
    state: row.state === "closed" ? "closed" : "open",
    updatedAt: row.updated_at,
  };
}

export function recordRecent(pr: DashboardPr): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO recent_pr
       (key, owner, repo, number, title, author, url, state, updated_at, viewed_at)
     VALUES
       (@key, @owner, @repo, @number, @title, @author, @url, @state, @updatedAt, @now)
     ON CONFLICT(key) DO UPDATE SET
       title = excluded.title,
       state = excluded.state,
       updated_at = excluded.updated_at,
       viewed_at = excluded.viewed_at`,
  ).run({
    key: prKey(pr),
    owner: pr.owner,
    repo: pr.repo,
    number: pr.number,
    title: pr.title,
    author: pr.author,
    url: pr.url,
    state: pr.state,
    updatedAt: pr.updatedAt,
    now: new Date().toISOString(),
  });
  // Trim to the most recent KEEP entries.
  db.prepare(
    `DELETE FROM recent_pr WHERE key NOT IN (
       SELECT key FROM recent_pr ORDER BY viewed_at DESC LIMIT ${KEEP}
     )`,
  ).run();
}

/** Recently viewed PRs, newest first; optionally scoped to one repo. */
export function listRecent(owner?: string, repo?: string): DashboardPr[] {
  const db = getDb();
  const rows = (
    owner && repo
      ? db
          .prepare(
            `SELECT * FROM recent_pr WHERE owner = ? AND repo = ? ORDER BY viewed_at DESC`,
          )
          .all(owner, repo)
      : db.prepare(`SELECT * FROM recent_pr ORDER BY viewed_at DESC`).all()
  ) as Row[];
  return rows.map(toDashboardPr);
}
