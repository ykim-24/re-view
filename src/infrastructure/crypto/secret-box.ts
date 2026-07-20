import "server-only";

/**
 * AES-256-GCM encryption for integration secrets stored in SQLite. The key is
 * derived (sha256) from INTEGRATIONS_SECRET in .env.local, so the .db file alone
 * can't reveal stored keys without that env secret. Serialized as iv:tag:cipher
 * (base64). All server-side, synchronous.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function hasSecretKey(): boolean {
  return Boolean(process.env.INTEGRATIONS_SECRET);
}

function key(): Buffer {
  const secret = process.env.INTEGRATIONS_SECRET;
  if (!secret) {
    throw new Error("INTEGRATIONS_SECRET is not set in .env.local");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

export function decryptSecret(blob: string): string {
  const [ivB, tagB, encB] = blob.split(":");
  if (!ivB || !tagB || !encB) {
    throw new Error("Malformed encrypted secret");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
