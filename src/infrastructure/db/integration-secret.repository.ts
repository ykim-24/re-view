import "server-only";

/**
 * Stores integration secrets (API keys) encrypted at rest. Only names/metadata
 * are ever listed; the plaintext is decrypted on demand server-side for a run.
 */

import { getDb } from "./client";
import { decryptSecret, encryptSecret } from "@/infrastructure/crypto/secret-box";
import type { SecretMeta } from "@/domain/integration/models";

interface SecretDbRow {
  name: string;
  value_enc: string;
  created_at: string;
}

export function listSecretNames(): string[] {
  const rows = getDb()
    .prepare(`SELECT name FROM integration_secret ORDER BY name`)
    .all() as Pick<SecretDbRow, "name">[];
  return rows.map((r) => r.name);
}

export function listSecrets(): SecretMeta[] {
  const rows = getDb()
    .prepare(`SELECT name, created_at FROM integration_secret ORDER BY name`)
    .all() as Pick<SecretDbRow, "name" | "created_at">[];
  return rows.map((r) => ({ name: r.name, createdAt: r.created_at }));
}

export function setSecret(name: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO integration_secret (name, value_enc, created_at)
       VALUES (@name, @value_enc, @created_at)
       ON CONFLICT(name) DO UPDATE SET value_enc = excluded.value_enc`,
    )
    .run({
      name,
      value_enc: encryptSecret(value),
      created_at: new Date().toISOString(),
    });
}

export function removeSecret(name: string): void {
  getDb().prepare(`DELETE FROM integration_secret WHERE name = ?`).run(name);
}

export function getSecretValue(name: string): string {
  const row = getDb()
    .prepare(`SELECT value_enc FROM integration_secret WHERE name = ?`)
    .get(name) as Pick<SecretDbRow, "value_enc"> | undefined;
  if (!row) {
    throw new Error(`No secret named "${name}"`);
  }
  return decryptSecret(row.value_enc);
}
