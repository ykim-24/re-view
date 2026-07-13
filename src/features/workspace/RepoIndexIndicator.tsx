"use client";

/**
 * Small header chip reflecting the repo symbol-index build. The index lets
 * go-to-definition reach functions defined outside the current PR's changed
 * files; this surfaces whether that's ready, still building, or failed.
 */

import { AlertTriangle, Boxes } from "lucide-react";
import { Loader } from "@/components/Loader";
import { Tooltip } from "@/components/Tooltip";
import { useRepoIndex } from "@/hooks/useRepoIndex";

interface RepoIndexIndicatorProps {
  owner: string;
  repo: string;
}

export function RepoIndexIndicator({ owner, repo }: RepoIndexIndicatorProps) {
  const { data } = useRepoIndex(owner, repo);

  if (!data || data.status === "building") return <BuildingChip />;
  if (data.status === "error") return <ErrorChip message={data.message} />;
  return (
    <ReadyChip fileCount={data.fileCount} symbolCount={data.symbolCount} />
  );
}

function BuildingChip() {
  return (
    <Tooltip content="Indexing the repo so go-to-definition reaches code outside this PR…">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader size="sm" /> Indexing…
      </span>
    </Tooltip>
  );
}

interface ReadyChipProps {
  fileCount: number;
  symbolCount: number;
}

function ReadyChip({ fileCount, symbolCount }: ReadyChipProps) {
  return (
    <Tooltip
      content={`Repo indexed — ${fileCount} files, ${symbolCount} symbols. Go-to-definition reaches the whole repo.`}
    >
      <span className="flex size-8 items-center justify-center text-muted-foreground">
        <Boxes className="h-4 w-4 text-emerald-400/80" />
      </span>
    </Tooltip>
  );
}

function ErrorChip({ message }: { message: string | null }) {
  return (
    <Tooltip content={message ?? "Repo index failed to build."}>
      <span className="flex size-8 items-center justify-center text-amber-400">
        <AlertTriangle className="h-4 w-4" />
      </span>
    </Tooltip>
  );
}
