import "server-only";

/**
 * Stores flows: an integration's capabilities. Each flow keeps a lightweight
 * `nodes` array (component id + explicit sparse order) as JSON; component bodies
 * live in the component table. Membership and order both come from `nodes`.
 */

import { getDb } from "./client";
import type { Flow, FlowNode } from "@/domain/integration/models";

interface FlowDbRow {
  id: string;
  integration_id: string;
  name: string;
  description: string;
  nodes: string;
  created_at: string;
  updated_at: string;
}

function isFlowNode(value: unknown): value is FlowNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { order?: unknown }).order === "number"
  );
}

function parseNodes(json: string): FlowNode[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isFlowNode);
  } catch {
    return [];
  }
}

function toModel(row: FlowDbRow): Flow {
  return {
    id: row.id,
    integrationId: row.integration_id,
    name: row.name,
    description: row.description,
    nodes: parseNodes(row.nodes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listFlows(integrationId: string): Flow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM flow WHERE integration_id = ? ORDER BY updated_at DESC`)
    .all(integrationId) as FlowDbRow[];
  return rows.map(toModel);
}

export function getFlow(id: string): Flow | null {
  const row = getDb()
    .prepare(`SELECT * FROM flow WHERE id = ?`)
    .get(id) as FlowDbRow | undefined;
  return row ? toModel(row) : null;
}

export function upsertFlow(row: {
  id: string;
  integrationId: string;
  name: string;
  description: string;
  nodes: FlowNode[];
}): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO flow (id, integration_id, name, description, nodes, created_at, updated_at)
       VALUES (@id, @integration_id, @name, @description, @nodes, @created_at, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         name        = excluded.name,
         description = excluded.description,
         nodes       = excluded.nodes,
         updated_at  = excluded.updated_at`,
    )
    .run({
      id: row.id,
      integration_id: row.integrationId,
      name: row.name,
      description: row.description,
      nodes: JSON.stringify(row.nodes),
      created_at: now,
      updated_at: now,
    });
}

export function removeFlow(id: string): void {
  getDb().prepare(`DELETE FROM flow WHERE id = ?`).run(id);
}
