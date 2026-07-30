/**
 * Chat models shared by the panel, the stream hook, and the API route.
 *
 * A `ChatAttachment` is a piece of the page the user pinned to a question — a
 * highlighted range in a diff, or a whole file. `ChatScope` is where the
 * conversation is anchored: the repo/PR the user is looking at plus the ref that
 * file reads resolve against. `ChatToolRun` is one tool call the agent made,
 * with its logs, so a message can show its own trace.
 */

export type ChatRole = "user" | "assistant";

export type ToolRunStatus = "running" | "done";

export interface ChatAttachment {
  id: string;
  kind: "selection" | "file";
  path: string;
  startLine?: number;
  endLine?: number;
  text?: string;
}

export type ChatScopeKind = "pr" | "compare" | "other";

export interface ChatScope {
  kind: ChatScopeKind;
  label: string;
  route: string;
  owner?: string;
  repo?: string;
  number?: number;
  ref?: string;
  openPath?: string;
}

/**
 * Whether this scope has code on screen to ask about. The chat is only offered on
 * the diff-bearing views (a pull request, a branch comparison) — on a dashboard or
 * a repo listing there is no selection to attach and no ref for its tools to read.
 */
export function scopeHasCode(scope: ChatScope | null): boolean {
  if (!scope) return false;
  return scope.kind === "pr" || scope.kind === "compare";
}

export interface ChatToolRun {
  id: string;
  name: string;
  label: string;
  logs: string[];
  status: ToolRunStatus;
  summary?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  attachments: ChatAttachment[];
  tools: ChatToolRun[];
  failed?: boolean;
}

export interface ChatTurn {
  role: ChatRole;
  text: string;
}

export interface ChatRequest {
  history: ChatTurn[];
  question: string;
  attachments: ChatAttachment[];
  scope: ChatScope | null;
}

/** Whether two attachments point at the same code, ignoring their generated ids. */
export function sameAttachment(a: ChatAttachment, b: ChatAttachment): boolean {
  return (
    a.kind === b.kind &&
    a.path === b.path &&
    a.startLine === b.startLine &&
    a.endLine === b.endLine
  );
}

/** A short "file.ts:12–20" style label for an attachment chip. */
export function attachmentLabel({
  path,
  startLine,
  endLine,
}: ChatAttachment): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (startLine === undefined) return name;
  if (endLine === undefined || endLine === startLine) return `${name}:${startLine}`;
  return `${name}:${startLine}–${endLine}`;
}
