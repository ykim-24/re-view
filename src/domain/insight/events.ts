/**
 * Wire protocol for the stepped insight pipeline. The server emits these as
 * newline-delimited JSON; the client rebuilds the step list, logs, gathered
 * file tree, and the streamed analysis from them.
 */

export interface GatheredFile {
  path: string;
  reason: string;
}

export interface StepPlanEntry {
  id: string;
  label: string;
}

export type InsightEvent =
  | { type: "plan"; steps: StepPlanEntry[] }
  | { type: "step_start"; id: string; label: string }
  | { type: "log"; message: string }
  | { type: "step_end"; id: string }
  | { type: "files"; files: GatheredFile[] }
  | { type: "token"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
