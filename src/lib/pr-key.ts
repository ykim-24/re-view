/** Stable key for a PR across the review queue: "owner/repo#number". */
export function prKey(ref: {
  owner: string;
  repo: string;
  number: number;
}): string {
  return `${ref.owner}/${ref.repo}#${ref.number}`;
}

/** Stable key for a saved repo: "owner/repo". */
export function repoKey(ref: { owner: string; repo: string }): string {
  return `${ref.owner}/${ref.repo}`;
}

/** What a saved summary describes — a PR, or a base…head branch comparison. */
export type SummaryTarget =
  | { kind: "pr"; owner: string; repo: string; number: number }
  | { kind: "compare"; owner: string; repo: string; base: string; head: string };

/** Stable key for a saved summary: "pr:owner/repo#123" or "cmp:owner/repo:base...head". */
export function summaryKey(target: SummaryTarget): string {
  if (target.kind === "pr") {
    return `pr:${target.owner}/${target.repo}#${target.number}`;
  }
  return `cmp:${target.owner}/${target.repo}:${target.base}...${target.head}`;
}
