import "server-only";

/**
 * Persistence for the repo-wide symbol index. `repo_index` holds the save point
 * (the indexed commit sha + status), `indexed_file` maps each file to its blob
 * sha (so incremental updates can re-scan only what changed), and `repo_symbol`
 * is the lookup table go-to-definition queries by name.
 */

import { getDb } from "./client";

export type IndexStatus = "building" | "ready" | "error";

export interface RepoIndexMeta {
  repoKey: string;
  headSha: string;
  status: IndexStatus;
  fileCount: number;
  symbolCount: number;
  message: string | null;
  indexedAt: string;
}

export interface SymbolRow {
  name: string;
  kind: string;
  path: string;
  line: number;
  endLine: number;
  exported: boolean;
}

export interface FileSymbols {
  path: string;
  blobSha: string;
  symbols: SymbolRow[];
}

export interface DefinitionHit {
  name: string;
  kind: string;
  path: string;
  line: number;
  endLine: number;
  exported: boolean;
}

interface MetaRow {
  repo_key: string;
  head_sha: string;
  status: IndexStatus;
  file_count: number;
  symbol_count: number;
  message: string | null;
  indexed_at: string;
}

function now(): string {
  return new Date().toISOString();
}

export function getRepoIndexMeta(repoKey: string): RepoIndexMeta | null {
  const row = getDb()
    .prepare("SELECT * FROM repo_index WHERE repo_key = ?")
    .get(repoKey) as MetaRow | undefined;
  if (!row) return null;
  return {
    repoKey: row.repo_key,
    headSha: row.head_sha,
    status: row.status,
    fileCount: row.file_count,
    symbolCount: row.symbol_count,
    message: row.message,
    indexedAt: row.indexed_at,
  };
}

export function setBuilding(repoKey: string, headSha: string): void {
  getDb()
    .prepare(
      `INSERT INTO repo_index (repo_key, head_sha, status, file_count, symbol_count, message, indexed_at)
       VALUES (@repo_key, @head_sha, 'building', 0, 0, NULL, @indexed_at)
       ON CONFLICT(repo_key) DO UPDATE SET
         head_sha = @head_sha, status = 'building', message = NULL, indexed_at = @indexed_at`,
    )
    .run({ repo_key: repoKey, head_sha: headSha, indexed_at: now() });
}

export function markError(
  repoKey: string,
  headSha: string,
  message: string,
): void {
  getDb()
    .prepare(
      `INSERT INTO repo_index (repo_key, head_sha, status, file_count, symbol_count, message, indexed_at)
       VALUES (@repo_key, @head_sha, 'error', 0, 0, @message, @indexed_at)
       ON CONFLICT(repo_key) DO UPDATE SET
         status = 'error', message = @message, indexed_at = @indexed_at`,
    )
    .run({
      repo_key: repoKey,
      head_sha: headSha,
      message,
      indexed_at: now(),
    });
}

export function getIndexedFileShas(repoKey: string): Map<string, string> {
  const rows = getDb()
    .prepare("SELECT path, blob_sha FROM indexed_file WHERE repo_key = ?")
    .all(repoKey) as { path: string; blob_sha: string }[];
  return new Map(rows.map((r) => [r.path, r.blob_sha]));
}

function insertFileSymbols(repoKey: string, file: FileSymbols): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO indexed_file (repo_key, path, blob_sha) VALUES (?, ?, ?)
     ON CONFLICT(repo_key, path) DO UPDATE SET blob_sha = excluded.blob_sha`,
  ).run(repoKey, file.path, file.blobSha);
  const insertSym = db.prepare(
    `INSERT INTO repo_symbol (repo_key, name, kind, path, line, end_line, exported)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const s of file.symbols) {
    insertSym.run(
      repoKey,
      s.name,
      s.kind,
      s.path,
      s.line,
      s.endLine,
      s.exported ? 1 : 0,
    );
  }
}

function refreshCounts(repoKey: string, headSha: string): void {
  const db = getDb();
  const files = (
    db
      .prepare("SELECT COUNT(*) AS n FROM indexed_file WHERE repo_key = ?")
      .get(repoKey) as { n: number }
  ).n;
  const symbols = (
    db
      .prepare("SELECT COUNT(*) AS n FROM repo_symbol WHERE repo_key = ?")
      .get(repoKey) as { n: number }
  ).n;
  db.prepare(
    `UPDATE repo_index SET head_sha = ?, status = 'ready', file_count = ?,
       symbol_count = ?, message = NULL, indexed_at = ? WHERE repo_key = ?`,
  ).run(headSha, files, symbols, now(), repoKey);
}

export function replaceIndex(
  repoKey: string,
  headSha: string,
  files: FileSymbols[],
): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM indexed_file WHERE repo_key = ?").run(repoKey);
    db.prepare("DELETE FROM repo_symbol WHERE repo_key = ?").run(repoKey);
    for (const file of files) insertFileSymbols(repoKey, file);
    refreshCounts(repoKey, headSha);
  });
  tx();
}

export function applyDelta(
  repoKey: string,
  headSha: string,
  changed: FileSymbols[],
  removed: string[],
): void {
  const db = getDb();
  const tx = db.transaction(() => {
    for (const path of removed) {
      db.prepare(
        "DELETE FROM indexed_file WHERE repo_key = ? AND path = ?",
      ).run(repoKey, path);
      db.prepare(
        "DELETE FROM repo_symbol WHERE repo_key = ? AND path = ?",
      ).run(repoKey, path);
    }
    for (const file of changed) {
      db.prepare(
        "DELETE FROM repo_symbol WHERE repo_key = ? AND path = ?",
      ).run(repoKey, file.path);
      insertFileSymbols(repoKey, file);
    }
    refreshCounts(repoKey, headSha);
  });
  tx();
}

export function lookupDefinitions(
  repoKey: string,
  name: string,
): DefinitionHit[] {
  const rows = getDb()
    .prepare(
      `SELECT name, kind, path, line, end_line, exported FROM repo_symbol
       WHERE repo_key = ? AND name = ?
       ORDER BY exported DESC, length(path) ASC
       LIMIT 25`,
    )
    .all(repoKey, name) as {
    name: string;
    kind: string;
    path: string;
    line: number;
    end_line: number;
    exported: number;
  }[];
  return rows.map((r) => ({
    name: r.name,
    kind: r.kind,
    path: r.path,
    line: r.line,
    endLine: r.end_line,
    exported: r.exported === 1,
  }));
}
