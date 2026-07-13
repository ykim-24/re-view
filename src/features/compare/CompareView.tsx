"use client";

/**
 * Branch comparison workspace: diff a head branch against a base (defaults to the
 * repo's default branch, changeable from the header). Reuses the diff viewer,
 * dependency tree, code-intel and insight — but without PR-only review/comments.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  GitCompareArrows,
  Columns2,
  Rows2,
  ScrollText,
  Code2,
  type LucideIcon,
} from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { Select } from "@/components/Select";
import { Loader } from "@/components/Loader";
import { cn } from "@/lib/utils";
import { useBranches } from "@/hooks/useBranches";
import { useCompare } from "@/hooks/useCompare";
import { useRepoActions } from "@/hooks/useSavedRepos";
import { useWorkspaceStore, type DiffMode } from "@/features/workspace/store";
import { DependencyTree } from "@/features/dependency-tree/DependencyTree";
import { ChangesPanel } from "@/features/changes-list/ChangesPanel";
import { DiffViewer } from "@/features/diff-viewer/DiffViewer";
import { CodeIntelPanel } from "@/features/code-intel-panel/CodeIntelPanel";
import { FileInsightButton } from "@/features/diff-viewer/FileInsightButton";
import { FileSpotlight } from "@/features/spotlight/FileSpotlight";
import { ContentSearch } from "@/features/spotlight/ContentSearch";
import { RepoIndexIndicator } from "@/features/workspace/RepoIndexIndicator";
import { SummaryView } from "@/features/summary/SummaryView";
import { FilePeekPanel } from "@/features/file-peek/FilePeekPanel";
import type { SummaryTarget } from "@/lib/pr-key";
import type { FileChange } from "@/domain/pull-request/models";

interface CompareViewProps {
  owner: string;
  repo: string;
  base: string;
  head: string;
}

const DIFF_MODES: Record<DiffMode, { Icon: LucideIcon; label: string }> = {
  split: { Icon: Columns2, label: "Split" },
  inline: { Icon: Rows2, label: "Inline" },
};

export function CompareView({ owner, repo, base, head }: CompareViewProps) {
  const router = useRouter();
  const branches = useBranches(owner, repo);
  const defaultBranch = branches.data?.defaultBranch ?? "";
  const effectiveBase = base || defaultBranch;

  const { data, isLoading, isError, error } = useCompare(
    owner,
    repo,
    effectiveBase,
    head,
  );

  const [summaryMode, setSummaryMode] = useState(false);
  const handleToggleSummary = () => setSummaryMode((v) => !v);

  const { saveRepo } = useRepoActions();
  const selectedPath = useWorkspaceStore((s) => s.selectedPath);
  const selectFile = useWorkspaceStore((s) => s.selectFile);
  const openPeek = useWorkspaceStore((s) => s.openPeek);
  const closePeek = useWorkspaceStore((s) => s.closePeek);
  const diffMode = useWorkspaceStore((s) => s.diffMode);
  const toggleDiffMode = useWorkspaceStore((s) => s.toggleDiffMode);
  const closeDefinition = useWorkspaceStore((s) => s.closeDefinition);
  const closeCommit = useWorkspaceStore((s) => s.closeCommit);

  const handleSummarySource = useCallback(
    (path: string, line?: number) => openPeek(path, line),
    [openPeek],
  );

  const files = useMemo(() => data?.files ?? [], [data]);
  const selectedFile = files.find((f) => f.path === selectedPath) ?? null;

  useEffect(() => {
    saveRepo(owner, repo);
  }, [owner, repo, saveRepo]);

  useEffect(() => {
    if (files.length > 0 && !files.some((f) => f.path === selectedPath)) {
      selectFile(files[0].path);
    }
  }, [files, selectedPath, selectFile]);

  useEffect(() => {
    return () => {
      closeDefinition();
      closeCommit();
      closePeek();
    };
  }, [owner, repo, head, closeDefinition, closeCommit, closePeek]);

  const baseOptions = useMemo(
    () =>
      (branches.data?.branches ?? []).map((b) => ({
        value: b.name,
        label: b.isDefault ? `${b.name} (default)` : b.name,
      })),
    [branches.data],
  );

  const handleBaseChange = (next: string) => {
    router.replace(
      `/repo/${owner}/${repo}/compare?base=${encodeURIComponent(
        next,
      )}&head=${encodeURIComponent(head)}`,
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Tooltip content="Back to branches">
          <Link
            href={`/repo/${owner}/${repo}/branches`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Tooltip>
        <GitCompareArrows className="h-5 w-5 text-sky-400" />
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">base</span>
              <div className="w-40">
                <Select
                  value={effectiveBase}
                  options={baseOptions}
                  onChange={handleBaseChange}
                />
              </div>
            </div>
          </div>
          <span className="text-muted-foreground">←</span>
          <Tooltip content={head}>
            <span className="flex items-center gap-1 truncate rounded-md border px-2 py-1 font-mono text-xs">
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              {head}
            </span>
          </Tooltip>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {data && (
            <span className="text-xs text-muted-foreground">
              {data.aheadBy} ahead · {data.behindBy} behind
            </span>
          )}
          <RepoIndexIndicator owner={owner} repo={repo} />
          <Tooltip content={summaryMode ? "Back to the diff" : "Summarize what this branch does"}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleSummary}
              disabled={!data || files.length === 0}
              className={cn("gap-1.5", summaryMode && "border-sky-400/60")}
            >
              {summaryMode && <Code2 className="h-4 w-4" />}
              {!summaryMode && <ScrollText className="h-4 w-4 text-sky-400" />}
              {summaryMode ? "Review" : "Summary"}
            </Button>
          </Tooltip>
          <DiffModeButton mode={diffMode} onToggle={toggleDiffMode} />
          <Tooltip content="Open compare on GitHub">
            <a
              href={`https://github.com/${owner}/${repo}/compare/${effectiveBase}...${head}`}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Tooltip>
        </div>
      </header>

      <CompareBody
        owner={owner}
        repo={repo}
        headRef={data?.head.sha ?? ""}
        baseRef={data?.mergeBaseSha ?? ""}
        files={files}
        selectedFile={selectedFile}
        isLoading={isLoading || branches.isLoading}
        isError={isError}
        errorMessage={error?.message}
        summaryTarget={{ kind: "compare", owner, repo, base: effectiveBase, head }}
        summaryMode={summaryMode}
        onSummarySource={handleSummarySource}
      />
    </div>
  );
}

interface CompareBodyProps {
  owner: string;
  repo: string;
  headRef: string;
  baseRef: string;
  files: FileChange[];
  selectedFile: FileChange | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  summaryTarget: SummaryTarget;
  summaryMode: boolean;
  onSummarySource(path: string, line?: number): void;
}

function CompareBody({
  owner,
  repo,
  headRef,
  baseRef,
  files,
  selectedFile,
  isLoading,
  isError,
  errorMessage,
  summaryTarget,
  summaryMode,
  onSummarySource,
}: CompareBodyProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader label="Comparing branches…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
        {errorMessage ?? "Failed to compare branches."}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        These branches are identical — no files differ.
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden">
      {summaryMode && (
        <SummaryView
          target={summaryTarget}
          currentHeadSha={headRef}
          onSourceClick={onSummarySource}
        />
      )}

      {!summaryMode && (
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize="22%" minSize="15%" maxSize="40%">
            <div className="flex h-full min-h-0 flex-col">
              <DependencyTree
                owner={owner}
                repo={repo}
                headRef={headRef}
                files={files}
              />
              <ChangesPanel file={selectedFile} />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize="78%">
            <CompareDiffArea
              owner={owner}
              repo={repo}
              baseRef={baseRef}
              headRef={headRef}
              file={selectedFile}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}

      <CodeIntelPanel paths={files.map((f) => f.path)} />

      <FilePeekPanel owner={owner} repo={repo} headRef={headRef} />

      <FileSpotlight files={files} />
      <ContentSearch
        owner={owner}
        repo={repo}
        headRef={headRef}
        paths={files.map((f) => f.path)}
      />
    </div>
  );
}

interface DiffModeButtonProps {
  mode: DiffMode;
  onToggle(): void;
}

function DiffModeButton({ mode, onToggle }: DiffModeButtonProps) {
  const { Icon, label } = DIFF_MODES[mode];
  return (
    <Tooltip content={`${label} view — toggle diff layout`}>
      <Button variant="ghost" size="icon" onClick={onToggle}>
        <Icon className="h-4 w-4" />
      </Button>
    </Tooltip>
  );
}

interface CompareDiffAreaProps {
  owner: string;
  repo: string;
  baseRef: string;
  headRef: string;
  file: FileChange | null;
}

function CompareDiffArea({
  owner,
  repo,
  baseRef,
  headRef,
  file,
}: CompareDiffAreaProps) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a file to view
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <Tooltip content={file.path} className="flex min-w-0 flex-1">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {file.path}
          </span>
        </Tooltip>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <FileInsightButton
            owner={owner}
            repo={repo}
            headRef={headRef}
            path={file.path}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <DiffViewer
          key={file.path}
          owner={owner}
          repo={repo}
          baseRef={baseRef}
          headRef={headRef}
          file={file}
        />
      </div>
    </div>
  );
}
