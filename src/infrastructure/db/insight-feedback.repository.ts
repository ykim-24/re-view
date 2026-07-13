import "server-only";

/**
 * Stores thumbs up/down on AI insights, with the full input (selection + lines)
 * and the generated text, so insight quality can be reviewed and evaluated later.
 */

import { getDb } from "./client";

export interface InsightFeedbackRow {
  repoKey: string;
  ref: string;
  path: string;
  startLine: number;
  endLine: number;
  selectedText: string;
  insight: string;
  rating: "up" | "down";
  model: string;
}

export function insertInsightFeedback(row: InsightFeedbackRow): void {
  getDb()
    .prepare(
      `INSERT INTO insight_feedback
       (repo_key, ref, path, start_line, end_line, selected_text, insight, rating, model, created_at)
       VALUES (@repo_key, @ref, @path, @start_line, @end_line, @selected_text, @insight, @rating, @model, @created_at)`,
    )
    .run({
      repo_key: row.repoKey,
      ref: row.ref,
      path: row.path,
      start_line: row.startLine,
      end_line: row.endLine,
      selected_text: row.selectedText,
      insight: row.insight,
      rating: row.rating,
      model: row.model,
      created_at: new Date().toISOString(),
    });
}
