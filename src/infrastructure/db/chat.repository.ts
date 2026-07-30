import "server-only";

/**
 * Persists the Ask Lizard transcript — one thread per PR, keyed by prKey — so the
 * conversation is still there after a reload. The messages are stored as a single
 * JSON blob because they are only ever read and written whole, and the user can
 * delete the thread outright.
 */

import { getDb } from "./client";

export function getChatThread(key: string): string | null {
  const row = getDb()
    .prepare(`SELECT messages FROM chat_thread WHERE key = ?`)
    .get(key) as { messages: string } | undefined;
  return row?.messages ?? null;
}

export function upsertChatThread(key: string, messages: string): void {
  getDb()
    .prepare(
      `INSERT INTO chat_thread (key, messages, updated_at)
       VALUES (@key, @messages, @updated_at)
       ON CONFLICT(key) DO UPDATE SET
         messages   = excluded.messages,
         updated_at = excluded.updated_at`,
    )
    .run({ key, messages, updated_at: new Date().toISOString() });
}

export function deleteChatThread(key: string): void {
  getDb().prepare(`DELETE FROM chat_thread WHERE key = ?`).run(key);
}
