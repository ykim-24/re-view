import "server-only";

/**
 * Stores components: the placed logic blocks a flow arranges. A component holds
 * its type, name, type-specific config (JSON, incl. canvas layout), and user
 * code. Flows reference components by id; this table owns the bodies.
 */

import { getDb } from "./client";
import type { Component, ComponentType } from "@/domain/integration/models";

interface ComponentDbRow {
  id: string;
  type: string;
  name: string;
  config: string;
  code: string;
  created_at: string;
  updated_at: string;
}

function isComponentType(value: string): value is ComponentType {
  return value === "button" || value === "sequence";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseConfig(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toModel(row: ComponentDbRow): Component {
  return {
    id: row.id,
    type: isComponentType(row.type) ? row.type : "button",
    name: row.name,
    config: parseConfig(row.config),
    code: row.code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getComponent(id: string): Component | null {
  const row = getDb()
    .prepare(`SELECT * FROM component WHERE id = ?`)
    .get(id) as ComponentDbRow | undefined;
  return row ? toModel(row) : null;
}

export function getComponents(ids: string[]): Component[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(`SELECT * FROM component WHERE id IN (${placeholders})`)
    .all(...ids) as ComponentDbRow[];
  return rows.map(toModel);
}

export function upsertComponent(row: {
  id: string;
  type: ComponentType;
  name: string;
  config: Record<string, unknown>;
  code: string;
}): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO component (id, type, name, config, code, created_at, updated_at)
       VALUES (@id, @type, @name, @config, @code, @created_at, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         type       = excluded.type,
         name       = excluded.name,
         config     = excluded.config,
         code       = excluded.code,
         updated_at = excluded.updated_at`,
    )
    .run({
      id: row.id,
      type: row.type,
      name: row.name,
      config: JSON.stringify(row.config),
      code: row.code,
      created_at: now,
      updated_at: now,
    });
}

export function removeComponent(id: string): void {
  getDb().prepare(`DELETE FROM component WHERE id = ?`).run(id);
}

export function removeComponents(ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(", ");
  getDb().prepare(`DELETE FROM component WHERE id IN (${placeholders})`).run(...ids);
}
