/** Pure domain types shared between server (infrastructure) and client (hooks/UI). */

export type FileStatus =
  | "added"
  | "modified"
  | "removed"
  | "renamed"
  | "copied"
  | "changed"
  | "unchanged";

export interface FileChange {
  /** path in the head branch (or previous for removed) */
  path: string;
  previousPath?: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  /** unified diff hunk text from GitHub; absent for binary/large files */
  patch?: string;
}

export interface PullRequest {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  merged: boolean;
  author: { login: string; avatarUrl: string };
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
  /** common ancestor of base and head — what GitHub diffs the PR against */
  mergeBaseSha: string;
  labels: Label[];
  url: string;
  createdAt: string;
}

export interface PullRequestData {
  pr: PullRequest;
  files: FileChange[];
}

export interface Label {
  name: string;
  color: string;
}

/** Lightweight PR row for the repo list (from pulls.list). */
export interface PullRequestSummary {
  number: number;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  merged: boolean;
  author: { login: string; avatarUrl: string };
  base: { ref: string };
  head: { ref: string };
  labels: Label[];
  createdAt: string;
  updatedAt: string;
  url: string;
}

export type PrStateFilter = "open" | "closed" | "all";

export interface SavedRepo {
  owner: string;
  repo: string;
  lastOpenedAt: string;
}

/** Minimal PR shape for the review dashboard (cross-repo lists). */
export interface DashboardPr {
  owner: string;
  repo: string;
  number: number;
  title: string;
  author: string;
  url: string;
  state: "open" | "closed";
  updatedAt: string;
}

export interface FinishedPr extends DashboardPr {
  finishedAt: string;
}

export interface CodeReference {
  path: string;
  url: string;
}

export interface PrComment {
  id: number;
  author: string;
  avatarUrl: string;
  body: string;
  createdAt: string;
  url: string;
}

/** An inline review-comment thread (a root comment plus its replies). */
export interface PrCommentThread {
  id: number;
  path: string;
  line: number | null;
  comments: PrComment[];
}

export interface PrComments {
  /** inline review threads, anchored to a file/line */
  threads: PrCommentThread[];
  /** top-level PR conversation (issue comments) */
  conversation: PrComment[];
}

export interface PrCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

/** A single commit's changes, diffed against its first parent. */
export interface CommitDetail {
  sha: string;
  parentSha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  files: FileChange[];
}

export interface QueueData {
  saved: DashboardPr[];
  finished: FinishedPr[];
}

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export interface InlineCommentDraft {
  path: string;
  /** last line in the head file the comment is anchored to */
  line: number;
  /** first line for a multi-line comment; omitted for single-line */
  startLine?: number;
  /** the exact text the reviewer highlighted, when any (kept for AI analysis) */
  selectedText?: string;
  side: "LEFT" | "RIGHT";
  body: string;
}

export interface SubmitReviewInput {
  owner: string;
  repo: string;
  number: number;
  event: ReviewEvent;
  body: string;
  comments: InlineCommentDraft[];
}
