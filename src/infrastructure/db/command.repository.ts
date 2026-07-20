import "server-only";

/** Retired Phase A store for saved commands (name + code). Superseded by the component model; kept until the flat-command UI is replaced. */

import { getDb } from "./client";
import type { Command } from "@/domain/integration/models";

interface CommandDbRow {
  id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

function toModel(row: CommandDbRow): Command {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listCommands(): Command[] {
  const rows = getDb()
    .prepare(`SELECT * FROM command ORDER BY updated_at DESC`)
    .all() as CommandDbRow[];
  return rows.map(toModel);
}

export function getCommand(id: string): Command | null {
  const row = getDb()
    .prepare(`SELECT * FROM command WHERE id = ?`)
    .get(id) as CommandDbRow | undefined;
  return row ? toModel(row) : null;
}

export function upsertCommand(row: { id: string; name: string; code: string }): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO command (id, name, code, created_at, updated_at)
       VALUES (@id, @name, @code, @created_at, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         code = excluded.code,
         updated_at = excluded.updated_at`,
    )
    .run({ id: row.id, name: row.name, code: row.code, created_at: now, updated_at: now });
}

export function removeCommand(id: string): void {
  getDb().prepare(`DELETE FROM command WHERE id = ?`).run(id);
}
