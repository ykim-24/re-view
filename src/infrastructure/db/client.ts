import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

interface ColumnInfo {
  name: string;
}

/**
 * Pre-create migrations that must run before the CREATE IF NOT EXISTS block.
 * Frees the `integration` name for the app model by renaming the Phase A
 * command-shaped `integration` table to `command` (data preserved).
 */
function migrateSchema(database: Database.Database): void {
  const cols = database
    .prepare(`PRAGMA table_info(integration)`)
    .all() as ColumnInfo[];
  const looksLikeCommand =
    cols.some((c) => c.name === "code") && !cols.some((c) => c.name === "description");
  if (!looksLikeCommand) return;
  const commandExists = database
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'command'`)
    .get();
  if (!commandExists) {
    database.exec(`ALTER TABLE integration RENAME TO command`);
  }
}

/** Singleton SQLite connection, stored in a gitignored local file. */
export function getDb(): Database.Database {
  if (db) return db;

  const dir = path.join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "re-view.db"));
  db.pragma("journal_mode = WAL");

  migrateSchema(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracked_pr (
      key         TEXT PRIMARY KEY,
      owner       TEXT NOT NULL,
      repo        TEXT NOT NULL,
      number      INTEGER NOT NULL,
      title       TEXT NOT NULL,
      author      TEXT NOT NULL,
      url         TEXT NOT NULL,
      state       TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      status      TEXT NOT NULL,
      finished_at TEXT,
      added_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_repo (
      key            TEXT PRIMARY KEY,
      owner          TEXT NOT NULL,
      repo           TEXT NOT NULL,
      last_opened_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recent_pr (
      key        TEXT PRIMARY KEY,
      owner      TEXT NOT NULL,
      repo       TEXT NOT NULL,
      number     INTEGER NOT NULL,
      title      TEXT NOT NULL,
      author     TEXT NOT NULL,
      url        TEXT NOT NULL,
      state      TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      viewed_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS repo_index (
      repo_key     TEXT PRIMARY KEY,
      head_sha     TEXT NOT NULL,
      status       TEXT NOT NULL,
      file_count   INTEGER NOT NULL DEFAULT 0,
      symbol_count INTEGER NOT NULL DEFAULT 0,
      message      TEXT,
      indexed_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS indexed_file (
      repo_key TEXT NOT NULL,
      path     TEXT NOT NULL,
      blob_sha TEXT NOT NULL,
      PRIMARY KEY (repo_key, path)
    );

    CREATE TABLE IF NOT EXISTS repo_symbol (
      repo_key TEXT NOT NULL,
      name     TEXT NOT NULL,
      kind     TEXT NOT NULL,
      path     TEXT NOT NULL,
      line     INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      exported INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_repo_symbol_lookup
      ON repo_symbol (repo_key, name);
    CREATE INDEX IF NOT EXISTS idx_indexed_file_repo
      ON indexed_file (repo_key);

    CREATE TABLE IF NOT EXISTS file_cache (
      repo_key   TEXT NOT NULL,
      ref        TEXT NOT NULL,
      path       TEXT NOT NULL,
      content    TEXT,
      fetched_at TEXT NOT NULL,
      PRIMARY KEY (repo_key, ref, path)
    );

    CREATE TABLE IF NOT EXISTS insight_feedback (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_key      TEXT NOT NULL,
      ref           TEXT NOT NULL,
      path          TEXT NOT NULL,
      start_line    INTEGER NOT NULL,
      end_line      INTEGER NOT NULL,
      selected_text TEXT NOT NULL,
      insight       TEXT NOT NULL,
      rating        TEXT NOT NULL,
      model         TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS summary (
      key        TEXT PRIMARY KEY,
      kind       TEXT NOT NULL,
      owner      TEXT NOT NULL,
      repo       TEXT NOT NULL,
      head_sha   TEXT NOT NULL,
      content    TEXT NOT NULL,
      model      TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration_secret (
      name       TEXT PRIMARY KEY,
      value_enc  TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS command (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      code       TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flow (
      id             TEXT PRIMARY KEY,
      integration_id TEXT NOT NULL,
      name           TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      nodes          TEXT NOT NULL DEFAULT '[]',
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_flow_integration
      ON flow (integration_id);

    CREATE TABLE IF NOT EXISTS component (
      id         TEXT PRIMARY KEY,
      type       TEXT NOT NULL,
      name       TEXT NOT NULL,
      config     TEXT NOT NULL DEFAULT '{}',
      code       TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_draft (
      key        TEXT PRIMARY KEY,
      drafts     TEXT NOT NULL,
      body       TEXT NOT NULL,
      event      TEXT NOT NULL,
      viewed     TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return db;
}
