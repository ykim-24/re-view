"use client";

/**
 * The review workspace shell: PR header, the file tree + diff (resizable), and
 * the overlaid go-to-definition panel and review bar. State in the workspace
 * store decides which file and definition are shown.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bot,
  ExternalLink,
  GitPullRequest,
  Columns2,
  Rows2,
  Keyboard,
  RefreshCw,
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
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePullRequest } from "@/hooks/usePullRequest";
import { usePrHeadPoll } from "@/hooks/usePrHeadPoll";
import { useRepoActions } from "@/hooks/useSavedRepos";
import { useRecordRecent } from "@/hooks/useRecentPrs";
import { useWorkspaceStore, type DiffMode } from "./store";
import { useReviewStore } from "@/features/review/store";
import { openModal } from "@/features/modal";
import { LeftPanel } from "./LeftPanel";
import { DiffViewer } from "@/features/diff-viewer/DiffViewer";
import { CodeIntelPanel } from "@/features/code-intel-panel/CodeIntelPanel";
import { ReviewBar } from "@/features/review/ReviewBar";
import { ViewedToggle } from "@/features/review/ViewedToggle";
import { FileInsightButton } from "@/features/diff-viewer/FileInsightButton";
import { FileSpotlight } from "@/features/spotlight/FileSpotlight";
import { ContentSearch } from "@/features/spotlight/ContentSearch";
import { ReviewQueueButton } from "@/features/dashboard/ReviewQueueButton";
import { AutoReviewPanel } from "@/features/review/AutoReviewPanel";
import { SummaryView } from "@/features/summary/SummaryView";
import { FilePeekPanel } from "@/features/file-peek/FilePeekPanel";
import { RepoIndexIndicator } from "./RepoIndexIndicator";
import { WorkspaceSkeleton } from "./WorkspaceSkeleton";
import { WorkspaceLoadError } from "./WorkspaceLoadError";
import { CommitDiffView } from "./CommitDiffView";
import type { DashboardPr, FileChange } from "@/domain/pull-request/models";

interface WorkspaceProps {
  owner: string;
  repo: string;
  number: number;
}

const DIFF_MODES: Record<DiffMode, { Icon: LucideIcon; label: string }> = {
  split: { Icon: Columns2, label: "Split" },
  inline: { Icon: Rows2, label: "Inline" },
};

export function Workspace({ owner, repo, number }: WorkspaceProps) {
  const { data, isLoading, isError, error, refetch, isFetching } =
    usePullRequest(owner, repo, number);
  const headPoll = usePrHeadPoll(owner, repo, number);
  const { saveRepo } = useRepoActions();
  const recordRecent = useRecordRecent();
  const forceLoading = useSearchParams().get("loading") !== null;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [summaryMode, setSummaryMode] = useState(false);

  const selectedPath = useWorkspaceStore((s) => s.selectedPath);
  const selectFile = useWorkspaceStore((s) => s.selectFile);
  const openPeek = useWorkspaceStore((s) => s.openPeek);
  const closePeek = useWorkspaceStore((s) => s.closePeek);
  const diffMode = useWorkspaceStore((s) => s.diffMode);
  const toggleDiffMode = useWorkspaceStore((s) => s.toggleDiffMode);
  const closeDefinition = useWorkspaceStore((s) => s.closeDefinition);
  const commitSha = useWorkspaceStore((s) => s.commitSha);
  const closeCommit = useWorkspaceStore((s) => s.closeCommit);
  const resetReview = useReviewStore((s) => s.reset);

  const files = useMemo(() => data?.files ?? [], [data]);
  const selectedFile = files.find((f) => f.path === selectedPath) ?? null;

  const handleOpenShortcuts = () => openModal({ type: "shortcuts" });
  const handleToggleReview = () => setReviewOpen((v) => !v);
  const handleCloseReview = () => setReviewOpen(false);
  const handleToggleSummary = () => setSummaryMode((v) => !v);
  const handleSummarySource = useCallback(
    (path: string, line?: number) => openPeek(path, line),
    [openPeek],
  );

  useEffect(() => {
    if (files.length > 0 && !files.some((f) => f.path === selectedPath)) {
      selectFile(files[0].path);
    }
  }, [files, selectedPath, selectFile]);

  useEffect(() => {
    return () => {
      resetReview();
      closeDefinition();
      closeCommit();
      closePeek();
    };
  }, [owner, repo, number, resetReview, closeDefinition, closeCommit, closePeek]);

  useEffect(() => {
    saveRepo(owner, repo);
  }, [owner, repo, saveRepo]);

  useEffect(() => {
    if (!data) return;
    const pr = data.pr;
    recordRecent({
      owner,
      repo,
      number,
      title: pr.title,
      author: pr.author.login,
      url: pr.url,
      state: pr.state,
      updatedAt: pr.createdAt,
    });
  }, [data, owner, repo, number, recordRecent]);

  useEffect(() => {
    if (isError) {
      openModal({
        type: "error",
        title: "Couldn’t load this pull request",
        message: error?.message ?? "Unknown error.",
      });
    }
  }, [isError, error]);

  useEffect(() => {
    const advanceToNextUnviewed = () => {
      const order = files.map((f) => f.path);
      if (order.length === 0) return;
      const { viewedFiles, markViewed } = useReviewStore.getState();
      const viewed = new Set(viewedFiles);
      if (selectedPath) {
        markViewed(selectedPath);
        viewed.add(selectedPath);
      }
      const startIdx = selectedPath ? order.indexOf(selectedPath) : -1;
      for (let step = 1; step <= order.length; step++) {
        const path = order[(startIdx + step) % order.length];
        if (!viewed.has(path)) {
          selectFile(path);
          return;
        }
      }
    };

    const handleKey = (e: globalThis.KeyboardEvent) => {
      const combo =
        (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "m";
      if (!combo) return;
      e.preventDefault();
      advanceToNextUnviewed();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [files, selectedPath, selectFile]);

  if (isLoading || forceLoading) {
    return <WorkspaceSkeleton />;
  }

  if (isError || !data) {
    return <WorkspaceLoadError onRetry={refetch} retrying={isFetching} />;
  }

  const { pr } = data;

  const latestSha = headPoll.data?.sha;
  const hasUpdate = Boolean(latestSha && latestSha !== pr.head.sha);

  const handleRefresh = () => {
    if (!hasUpdate) {
      toast("No new changes");
      return;
    }
    refetch();
    toast.success("Refreshed to the latest commit");
  };

  const prSnapshot: DashboardPr = {
    owner,
    repo,
    number,
    title: pr.title,
    author: pr.author.login,
    url: pr.url,
    state: pr.state,
    updatedAt: pr.createdAt,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Tooltip content="Back to pull requests">
          <Link
            href={`/repo/${owner}/${repo}/pulls`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Tooltip>
        <GitPullRequest className="h-5 w-5 text-emerald-400" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{pr.title}</span>
            <Badge variant="secondary" className="shrink-0">
              #{pr.number}
            </Badge>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {pr.author.login} · <code>{pr.base.ref}</code> ←{" "}
            <code>{pr.head.ref}</code>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <RepoIndexIndicator owner={owner} repo={repo} />
          <Tooltip content={summaryMode ? "Back to the diff" : "Summarize what this PR does"}>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleSummary}
              className={cn("gap-1.5", summaryMode && "border-sky-400/60")}
            >
              {summaryMode && <Code2 className="h-4 w-4" />}
              {!summaryMode && <ScrollText className="h-4 w-4 text-sky-400" />}
              {summaryMode ? "Review" : "Summary"}
            </Button>
          </Tooltip>
          <Tooltip content="Auto review the whole PR">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleReview}
              className="gap-1.5"
            >
              <Bot className="h-4 w-4 text-emerald-400" />
              Auto review
            </Button>
          </Tooltip>
          <ReviewQueueButton pr={prSnapshot} />
          <Tooltip
            content={hasUpdate ? "New commits — refresh" : "Check for updates"}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className={cn(hasUpdate && "rev-refresh-glow text-amber-400")}
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4",
                  (isFetching || headPoll.isFetching) && "animate-spin",
                )}
              />
            </Button>
          </Tooltip>
          <DiffModeButton mode={diffMode} onToggle={toggleDiffMode} />
          <Tooltip content="Shortcuts">
            <Button variant="ghost" size="icon" onClick={handleOpenShortcuts}>
              <Keyboard className="h-4 w-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Open on GitHub">
            <a
              href={pr.url}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </Tooltip>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {summaryMode && (
          <SummaryView
            target={{ kind: "pr", owner, repo, number }}
            currentHeadSha={latestSha ?? pr.head.sha}
            onSourceClick={handleSummarySource}
          />
        )}

        {!summaryMode && (
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel defaultSize="22%" minSize="15%" maxSize="40%">
              <LeftPanel
                owner={owner}
                repo={repo}
                pr={pr}
                files={files}
                selectedFile={selectedFile}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="78%">
              <DiffArea
                owner={owner}
                repo={repo}
                number={number}
                baseRef={pr.mergeBaseSha}
                headRef={pr.head.sha}
                file={selectedFile}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}

        <CodeIntelPanel paths={files.map((f) => f.path)} />

        <FilePeekPanel owner={owner} repo={repo} headRef={pr.head.sha} />

        {reviewOpen && (
          <AutoReviewPanel
            owner={owner}
            repo={repo}
            number={number}
            onClose={handleCloseReview}
          />
        )}

        {commitSha && (
          <CommitDiffView
            owner={owner}
            repo={repo}
            number={number}
            sha={commitSha}
            onClose={closeCommit}
          />
        )}
      </div>

      <FileSpotlight files={files} />
      <ContentSearch
        owner={owner}
        repo={repo}
        headRef={pr.head.sha}
        paths={files.map((f) => f.path)}
      />

      <ReviewBar
        owner={owner}
        repo={repo}
        number={number}
        prSnapshot={prSnapshot}
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

interface DiffAreaProps {
  owner: string;
  repo: string;
  number: number;
  baseRef: string;
  headRef: string;
  file: FileChange | null;
}

function DiffArea({
  owner,
  repo,
  number,
  baseRef,
  headRef,
  file,
}: DiffAreaProps) {
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a file to review
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
          <ViewedToggle path={file.path} />
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <DiffViewer
          key={file.path}
          owner={owner}
          repo={repo}
          number={number}
          baseRef={baseRef}
          headRef={headRef}
          file={file}
        />
      </div>
    </div>
  );
}
