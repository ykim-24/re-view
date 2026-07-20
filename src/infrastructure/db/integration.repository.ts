import "server-only";

/** Stores integrations (apps): a name + description container that owns flows and secrets. */

import { getDb } from "./client";
import type { Integration } from "@/domain/integration/models";

interface IntegrationDbRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

function toModel(row: IntegrationDbRow): Integration {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listIntegrations(): Integration[] {
  const rows = getDb()
    .prepare(`SELECT * FROM integration ORDER BY updated_at DESC`)
    .all() as IntegrationDbRow[];
  return rows.map(toModel);
}

export function getIntegration(id: string): Integration | null {
  const row = getDb()
    .prepare(`SELECT * FROM integration WHERE id = ?`)
    .get(id) as IntegrationDbRow | undefined;
  return row ? toModel(row) : null;
}

export function upsertIntegration(row: {
  id: string;
  name: string;
  description: string;
}): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO integration (id, name, description, created_at, updated_at)
       VALUES (@id, @name, @description, @created_at, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         name        = excluded.name,
         description = excluded.description,
         updated_at  = excluded.updated_at`,
    )
    .run({
      id: row.id,
      name: row.name,
      description: row.description,
      created_at: now,
      updated_at: now,
    });
}

export function removeIntegration(id: string): void {
  getDb().prepare(`DELETE FROM integration WHERE id = ?`).run(id);
}
