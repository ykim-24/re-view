import "server-only";

/**
 * Persists the unsubmitted state of an in-progress review (staged inline
 * comments, the summary body, the pending event, and viewed-file marks) keyed by
 * prKey, so a review survives a page reload or a server restart. Cleared once the
 * review is submitted. Stored as JSON blobs since it is read/written whole.
 */

import { getDb } from "./client";
import type {
  InlineCommentDraft,
  ReviewDraftState,
  ReviewEvent,
} from "@/domain/pull-request/models";

interface ReviewDraftDbRow {
  drafts: string;
  body: string;
  event: string;
  viewed: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReviewEvent(value: unknown): value is ReviewEvent {
  return value === "APPROVE" || value === "REQUEST_CHANGES" || value === "COMMENT";
}

function isInlineCommentDraft(value: unknown): value is InlineCommentDraft {
  if (!isRecord(value)) return false;
  return (
    typeof value.path === "string" &&
    typeof value.line === "number" &&
    typeof value.body === "string" &&
    (value.side === "LEFT" || value.side === "RIGHT")
  );
}

function parseDrafts(json: string): InlineCommentDraft[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isInlineCommentDraft);
  } catch {
    return [];
  }
}

function parseViewed(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

export function getReviewDraft(key: string): ReviewDraftState | null {
  const row = getDb()
    .prepare(`SELECT drafts, body, event, viewed FROM review_draft WHERE key = ?`)
    .get(key) as ReviewDraftDbRow | undefined;
  if (!row) return null;
  return {
    drafts: parseDrafts(row.drafts),
    body: row.body,
    event: isReviewEvent(row.event) ? row.event : "COMMENT",
    viewed: parseViewed(row.viewed),
  };
}

export function saveReviewDraft(key: string, state: ReviewDraftState): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO review_draft (key, drafts, body, event, viewed, updated_at)
       VALUES (@key, @drafts, @body, @event, @viewed, @updated_at)
       ON CONFLICT(key) DO UPDATE SET
         drafts     = excluded.drafts,
         body       = excluded.body,
         event      = excluded.event,
         viewed     = excluded.viewed,
         updated_at = excluded.updated_at`,
    )
    .run({
      key,
      drafts: JSON.stringify(state.drafts),
      body: state.body,
      event: isReviewEvent(state.event) ? state.event : "COMMENT",
      viewed: JSON.stringify(state.viewed),
      updated_at: now,
    });
}

export function deleteReviewDraft(key: string): void {
  getDb().prepare(`DELETE FROM review_draft WHERE key = ?`).run(key);
}
