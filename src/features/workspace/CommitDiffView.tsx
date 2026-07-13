"use client";

/**
 * Full-area view of a single commit's diff (parent → commit), shown when a
 * commit is clicked in the history. Reuses the diff viewer with the commit's
 * own refs so you see exactly what that commit changed.
 */

import { useState } from "react";
import { ArrowLeft, FileDiff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/Tooltip";
import { useCommit } from "@/hooks/useCommit";
import { DiffViewer } from "@/features/diff-viewer/DiffViewer";
import type { CommitDetail, FileChange } from "@/domain/pull-request/models";

const STATUS_COLOR: Record<string, string> = {
  added: "text-emerald-400",
  removed: "text-red-400",
  modified: "text-amber-400",
  renamed: "text-sky-400",
};

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function firstLine(message: string): string {
  return message.split("\n")[0];
}

interface CommitDiffViewProps {
  owner: string;
  repo: string;
  number: number;
  sha: string;
  onClose(): void;
}

export function CommitDiffView({
  owner,
  repo,
  number,
  sha,
  onClose,
}: CommitDiffViewProps) {
  const { data, isLoading, isError, error } = useCommit(owner, repo, sha);

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5">
        <Tooltip content="Back to PR">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Tooltip>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {data ? firstLine(data.message) : "Loading commit…"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            <code>{sha.slice(0, 7)}</code>
            {data ? ` · ${data.author} · ${data.files.length} files` : ""}
          </div>
        </div>
      </header>

      <Body owner={owner} repo={repo} number={number} data={data} isLoading={isLoading} isError={isError} error={error} />
    </div>
  );
}

interface BodyProps {
  owner: string;
  repo: string;
  number: number;
  data: CommitDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

function Body({ owner, repo, number, data, isLoading, isError, error }: BodyProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader label="Loading commit…" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
        {error?.message ?? "Failed to load commit."}
      </div>
    );
  }
  return <Loaded owner={owner} repo={repo} number={number} commit={data} />;
}

interface LoadedProps {
  owner: string;
  repo: string;
  number: number;
  commit: CommitDetail;
}

function Loaded({ owner, repo, number, commit }: LoadedProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedFile =
    commit.files.find((f) => f.path === selected) ?? commit.files[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-64 shrink-0 flex-col border-r">
        <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Files in commit
          </span>
          <span className="text-xs text-muted-foreground">
            {commit.files.length}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1 text-sm">
          {commit.files.map((file) => (
            <CommitFileRow
              key={file.path}
              file={file}
              active={selectedFile?.path === file.path}
              onSelect={setSelected}
            />
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <CommitDiff
          owner={owner}
          repo={repo}
          number={number}
          commit={commit}
          file={selectedFile}
        />
      </div>
    </div>
  );
}

interface CommitFileRowProps {
  file: FileChange;
  active: boolean;
  onSelect(path: string): void;
}

function CommitFileRow({ file, active, onSelect }: CommitFileRowProps) {
  const handleClick = () => onSelect(file.path);
  return (
    <Tooltip content={file.path} className="block">
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-1.5 px-3 py-1 text-left hover:bg-muted/60",
          active && "bg-muted",
        )}
      >
        <FileDiff
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            STATUS_COLOR[file.status] ?? "text-muted-foreground",
          )}
        />
        <span className="truncate">{basename(file.path)}</span>
        <span className="ml-auto shrink-0 pl-2 text-[10px] tabular-nums text-muted-foreground">
          <span className="text-emerald-400">+{file.additions}</span>{" "}
          <span className="text-red-400">-{file.deletions}</span>
        </span>
      </button>
    </Tooltip>
  );
}

interface CommitDiffProps {
  owner: string;
  repo: string;
  number: number;
  commit: CommitDetail;
  file: FileChange | null;
}

function CommitDiff({ owner, repo, number, commit, file }: CommitDiffProps) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No files in this commit
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <Tooltip content={file.path} className="flex min-w-0">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {file.path}
          </span>
        </Tooltip>
      </div>
      <div className="min-h-0 flex-1">
        <DiffViewer
          key={file.path}
          owner={owner}
          repo={repo}
          number={number}
          baseRef={commit.parentSha}
          headRef={commit.sha}
          file={file}
        />
      </div>
    </div>
  );
}
