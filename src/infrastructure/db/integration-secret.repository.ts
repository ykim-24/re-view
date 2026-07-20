import "server-only";

/**
 * Stores integration secrets (API keys) encrypted at rest, scoped either to a
 * single integration or globally. Resolution is Postman-style: an integration's
 * own secret overrides a global one of the same name. Only names/metadata are
 * listed; plaintext is decrypted on demand server-side for a run.
 */

import { randomUUID } from "node:crypto";
import { getDb } from "./client";
import { decryptSecret, encryptSecret } from "@/infrastructure/crypto/secret-box";
import type { SecretMeta, SecretScope } from "@/domain/integration/models";

interface SecretDbRow {
  id: string;
  name: string;
  value_enc: string;
  scope: string;
  integration_id: string;
  created_at: string;
}

function toScope(value: string): SecretScope {
  return value === "integration" ? "integration" : "global";
}

function toMeta(row: Omit<SecretDbRow, "value_enc">): SecretMeta {
  return {
    id: row.id,
    name: row.name,
    scope: toScope(row.scope),
    integrationId: row.integration_id,
    createdAt: row.created_at,
  };
}

/** Global secrets plus the given integration's own — what that integration can use. */
export function listSecretsForIntegration(integrationId: string): SecretMeta[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, scope, integration_id, created_at
       FROM integration_secret
       WHERE scope = 'global' OR (scope = 'integration' AND integration_id = ?)
       ORDER BY scope DESC, name`,
    )
    .all(integrationId) as Omit<SecretDbRow, "value_enc">[];
  return rows.map(toMeta);
}

export function setSecret(input: {
  name: string;
  value: string;
  scope: SecretScope;
  integrationId: string;
}): void {
  const now = new Date().toISOString();
  const integrationId = input.scope === "integration" ? input.integrationId : "";
  getDb()
    .prepare(
      `INSERT INTO integration_secret
         (id, name, value_enc, scope, integration_id, created_at, updated_at)
       VALUES (@id, @name, @value_enc, @scope, @integration_id, @created_at, @updated_at)
       ON CONFLICT(scope, integration_id, name) DO UPDATE SET
         value_enc  = excluded.value_enc,
         updated_at = excluded.updated_at`,
    )
    .run({
      id: randomUUID(),
      name: input.name,
      value_enc: encryptSecret(input.value),
      scope: input.scope,
      integration_id: integrationId,
      created_at: now,
      updated_at: now,
    });
}

export function removeSecret(id: string): void {
  getDb().prepare(`DELETE FROM integration_secret WHERE id = ?`).run(id);
}

/** Names an integration can reference — its own plus globals (deduped, own wins). */
export function resolveSecretNames(integrationId: string): string[] {
  return [...new Set(listSecretsForIntegration(integrationId).map((s) => s.name))];
}

/** Decrypt a secret by name for the integration, preferring its own over global. */
export function resolveSecretValue(name: string, integrationId: string): string {
  const db = getDb();
  const own = db
    .prepare(
      `SELECT value_enc FROM integration_secret
       WHERE scope = 'integration' AND integration_id = ? AND name = ?`,
    )
    .get(integrationId, name) as Pick<SecretDbRow, "value_enc"> | undefined;
  const global = db
    .prepare(`SELECT value_enc FROM integration_secret WHERE scope = 'global' AND name = ?`)
    .get(name) as Pick<SecretDbRow, "value_enc"> | undefined;
  const row = own ?? global;
  if (!row) throw new Error(`No secret named "${name}"`);
  return decryptSecret(row.value_enc);
}
