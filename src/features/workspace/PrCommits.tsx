"use client";

/** Commit history for the Details tab — newest first, each linking to GitHub. */

import { GitCommitHorizontal } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { Loader } from "@/components/Loader";
import { Tooltip } from "@/components/Tooltip";
import { usePrCommits } from "@/hooks/usePrCommits";
import { useWorkspaceStore } from "@/features/workspace/store";
import type { PrCommit } from "@/domain/pull-request/models";

function firstLine(message: string): string {
  return message.split("\n")[0];
}

interface PrCommitsProps {
  owner: string;
  repo: string;
  number: number;
}

export function PrCommits({ owner, repo, number }: PrCommitsProps) {
  const { data, isLoading, isError, error } = usePrCommits(owner, repo, number);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground">
        <Loader size="sm" /> Loading commits…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-6 text-xs text-destructive">
        {error?.message ?? "Failed to load commits."}
      </div>
    );
  }

  const commits = data?.commits ?? [];
  if (commits.length === 0) {
    return (
      <div className="px-4 py-6 text-xs text-muted-foreground">No commits.</div>
    );
  }

  return (
    <div className="py-1">
      {commits.map((commit) => (
        <CommitRow key={commit.sha} commit={commit} />
      ))}
    </div>
  );
}

function CommitRow({ commit }: { commit: PrCommit }) {
  const viewCommit = useWorkspaceStore((s) => s.viewCommit);
  const handleClick = () => viewCommit(commit.sha);
  return (
    <Tooltip content="View this commit's changes" className="block">
      <button
        onClick={handleClick}
        className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-muted/50"
      >
        <GitCommitHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs">{firstLine(commit.message)}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            <code>{commit.sha.slice(0, 7)}</code> · {commit.author} ·{" "}
            {timeAgo(commit.date)}
          </div>
        </div>
      </button>
    </Tooltip>
  );
}
