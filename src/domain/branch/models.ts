/** Domain types for branches and arbitrary ref-to-ref comparisons. */

import type { FileChange } from "@/domain/pull-request/models";

export interface BranchSummary {
  name: string;
  sha: string;
  isDefault: boolean;
  protected: boolean;
}

export interface BranchList {
  branches: BranchSummary[];
  defaultBranch: string;
}

export type CompareStatus = "ahead" | "behind" | "identical" | "diverged";

/** A comparison of two refs, shaped like PullRequestData for reuse in the diff UI. */
export interface CompareData {
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
  /** common ancestor of base and head — what the diff is computed against */
  mergeBaseSha: string;
  status: CompareStatus;
  aheadBy: number;
  behindBy: number;
  files: FileChange[];
}
