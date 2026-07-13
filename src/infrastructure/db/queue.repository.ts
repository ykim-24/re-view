import "server-only";
import { getDb } from "./client";
import { prKey } from "@/lib/pr-key";
import type {
  DashboardPr,
  FinishedPr,
  QueueData,
} from "@/domain/pull-request/models";

interface Row {
  owner: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  state: string;
  updated_at: string;
  finished_at: string | null;
}

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

export function listQueue(): QueueData {
  const db = getDb();
  const saved = db
    .prepare(`SELECT * FROM tracked_pr WHERE status = 'saved' ORDER BY updated_at DESC`)
    .all() as Row[];
  const finished = db
    .prepare(`SELECT * FROM tracked_pr WHERE status = 'finished' ORDER BY finished_at DESC`)
    .all() as Row[];
  return {
    saved: saved.map(toDashboardPr),
    finished: finished.map((row) => ({
      ...toDashboardPr(row),
      finishedAt: row.finished_at ?? "",
    })) as FinishedPr[],
  };
}

function upsert(pr: DashboardPr, status: "saved" | "finished", now: string) {
  const db = getDb();
  const finishedAt = status === "finished" ? now : null;
  db.prepare(
    `INSERT INTO tracked_pr
       (key, owner, repo, number, title, author, url, state, updated_at, status, finished_at, added_at)
     VALUES
       (@key, @owner, @repo, @number, @title, @author, @url, @state, @updatedAt, @status, @finishedAt, @now)
     ON CONFLICT(key) DO UPDATE SET
       title = excluded.title,
       author = excluded.author,
       url = excluded.url,
       state = excluded.state,
       updated_at = excluded.updated_at,
       status = excluded.status,
       finished_at = excluded.finished_at`,
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
    status,
    finishedAt,
    now,
  });
}

export function addToReview(pr: DashboardPr): void {
  upsert(pr, "saved", new Date().toISOString());
}

export function markFinished(pr: DashboardPr): void {
  upsert(pr, "finished", new Date().toISOString());
}

/** Move a finished PR back into the review list. */
export function unmarkFinished(key: string): void {
  getDb()
    .prepare(`UPDATE tracked_pr SET status = 'saved', finished_at = NULL WHERE key = ?`)
    .run(key);
}

export function removeFromReview(key: string): void {
  getDb().prepare(`DELETE FROM tracked_pr WHERE key = ?`).run(key);
}
