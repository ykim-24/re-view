import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

let db: Database.Database | null = null;

interface ColumnInfo {
  name: string;
}

function tableExists(database: Database.Database, name: string): boolean {
  return Boolean(
    database
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(name),
  );
}

function columns(database: Database.Database, table: string): string[] {
  return (database.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[]).map(
    (c) => c.name,
  );
}

/**
 * Pre-create migrations that must run before the CREATE IF NOT EXISTS block:
 * frees the `integration` name for the app model by renaming the Phase A
 * command-shaped `integration` table to `command`, and sets aside a pre-scopes
 * `integration_secret` table so the scoped one can be created fresh. Data is
 * preserved and copied over in migratePost.
 */
function migrateSchema(database: Database.Database): void {
  const intgCols = columns(database, "integration");
  const looksLikeCommand = intgCols.includes("code") && !intgCols.includes("description");
  if (looksLikeCommand && !tableExists(database, "command")) {
    database.exec(`ALTER TABLE integration RENAME TO command`);
  }

  const secretCols = columns(database, "integration_secret");
  const preScopes = secretCols.length > 0 && !secretCols.includes("scope");
  if (preScopes && !tableExists(database, "integration_secret_old")) {
    database.exec(`ALTER TABLE integration_secret RENAME TO integration_secret_old`);
  }
}

/** Post-create migrations that copy preserved data into the newly-created tables. */
function migratePost(database: Database.Database): void {
  if (!tableExists(database, "integration_secret_old")) return;
  database.exec(`
    INSERT OR IGNORE INTO integration_secret
      (id, name, value_enc, scope, integration_id, created_at, updated_at)
    SELECT lower(hex(randomblob(16))), name, value_enc, 'global', '', created_at, created_at
    FROM integration_secret_old;
    DROP TABLE integration_secret_old;
  `);
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

    CREATE TABLE IF NOT EXISTS chat_thread (
      key        TEXT PRIMARY KEY,
      messages   TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integration_secret (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      value_enc      TEXT NOT NULL,
      scope          TEXT NOT NULL DEFAULT 'global',
      integration_id TEXT NOT NULL DEFAULT '',
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_secret_scope
      ON integration_secret (scope, integration_id, name);

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

  migratePost(db);

  return db;
}
