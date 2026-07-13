"use client";

/** A PR row in the dashboard lists, linking to the review workspace. */

import type { ReactNode } from "react";
import Link from "next/link";
import { GitPullRequest, GitPullRequestClosed } from "lucide-react";
import { timeAgo } from "@/lib/time";
import type { DashboardPr } from "@/domain/pull-request/models";

interface DashboardPrRowProps {
  pr: DashboardPr;
  actions: ReactNode;
}

export function DashboardPrRow({ pr, actions }: DashboardPrRowProps) {
  return (
    <div className="flex items-center gap-2 border-b px-4 py-2.5 hover:bg-muted/40">
      <Link
        href={`/pr/${pr.owner}/${pr.repo}/${pr.number}`}
        className="flex min-w-0 flex-1 items-start gap-3"
      >
        <span className="mt-0.5 shrink-0">
          <StateIcon state={pr.state} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{pr.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {pr.owner}/{pr.repo} #{pr.number} · {pr.author} · updated{" "}
            {timeAgo(pr.updatedAt)}
          </div>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </div>
  );
}

function StateIcon({ state }: { state: DashboardPr["state"] }) {
  if (state === "closed")
    return <GitPullRequestClosed className="h-4 w-4 text-red-400" />;
  return <GitPullRequest className="h-4 w-4 text-emerald-400" />;
}
