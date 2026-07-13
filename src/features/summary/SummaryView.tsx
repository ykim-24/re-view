"use client";

/**
 * Full-page PR / branch summary that takes over the workspace body (tree + diff)
 * in "summary mode". Loads the saved summary instantly, renders it with clickable
 * source citations (which flip back to the diff at that location), and — reusing
 * head-change detection — offers an incremental Update when the head has moved
 * past the summarized commit.
 */

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollText, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { Markdown } from "@/components/Markdown";
import { Loader } from "@/components/Loader";
import { StepLogs } from "@/features/diff-viewer/StepLogs";
import { SectionNav } from "./SectionNav";
import { useSummary } from "@/hooks/useSummary";
import { useSummaryStream } from "@/hooks/useSummaryStream";
import { summaryKey, type SummaryTarget } from "@/lib/pr-key";
import { timeAgo } from "@/lib/time";

interface SummaryViewProps {
  target: SummaryTarget;
  /** the head the view currently shows — a summary at a different sha is stale */
  currentHeadSha: string;
  onSourceClick(path: string, line?: number): void;
}

export function SummaryView({ target, currentHeadSha, onSourceClick }: SummaryViewProps) {
  const key = summaryKey(target);
  const saved = useSummary(target);
  const { steps, files, answer, isStreaming, run } = useSummaryStream();
  const qc = useQueryClient();

  const runMode = useCallback(
    (mode: "generate" | "update") => {
      const body =
        target.kind === "pr"
          ? { kind: "pr", owner: target.owner, repo: target.repo, number: target.number, mode }
          : {
              kind: "compare",
              owner: target.owner,
              repo: target.repo,
              base: target.base,
              head: target.head,
              mode,
            };
      run(body);
    },
    [target, run],
  );

  const handleGenerate = useCallback(() => runMode("generate"), [runMode]);
  const handleUpdate = useCallback(() => runMode("update"), [runMode]);

  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !isStreaming) {
      qc.invalidateQueries({ queryKey: ["summary", key] });
    }
    wasStreaming.current = isStreaming;
  }, [isStreaming, qc, key]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const savedSummary = saved.data ?? null;
  const isStale = Boolean(savedSummary && savedSummary.headSha !== currentHeadSha);
  const content = answer || savedSummary?.content || "";

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <SummaryToolbar
        isStreaming={isStreaming}
        savedAt={savedSummary?.updatedAt}
        headSha={savedSummary?.headSha}
        isStale={isStale}
        hasSaved={Boolean(savedSummary)}
        onUpdate={handleUpdate}
        onRegenerate={handleGenerate}
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <SummaryContent
            content={content}
            isStreaming={isStreaming}
            isLoading={saved.isLoading}
            onGenerate={handleGenerate}
            onSourceClick={onSourceClick}
          />
        </div>
      </div>

      {!isStreaming && content && (
        <SectionNav scrollRef={scrollRef} content={content} />
      )}

      {steps.length > 0 && (
        <div className="shrink-0 p-2">
          <StepLogs steps={steps} files={files} isStreaming={isStreaming} />
        </div>
      )}
    </div>
  );
}

interface SummaryToolbarProps {
  isStreaming: boolean;
  savedAt?: string;
  headSha?: string;
  isStale: boolean;
  hasSaved: boolean;
  onUpdate(): void;
  onRegenerate(): void;
}

function SummaryToolbar({
  isStreaming,
  savedAt,
  headSha,
  isStale,
  hasSaved,
  onUpdate,
  onRegenerate,
}: SummaryToolbarProps) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-xs text-muted-foreground">
      <ScrollText className="h-4 w-4 shrink-0 text-sky-400" />
      <span className="font-medium text-foreground">Summary</span>
      {isStreaming && (
        <span className="flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Working…
        </span>
      )}
      {!isStreaming && hasSaved && savedAt && <span>Updated {timeAgo(savedAt)}</span>}
      {!isStreaming && hasSaved && headSha && (
        <span className="font-mono text-muted-foreground/70">{headSha.slice(0, 7)}</span>
      )}

      {!isStreaming && hasSaved && (
        <div className="ml-auto flex items-center gap-1.5">
          {isStale && (
            <Button
              variant="outline"
              size="sm"
              onClick={onUpdate}
              className="h-7 gap-1 rev-refresh-glow px-2 text-amber-400"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Update
            </Button>
          )}
          <Tooltip content="Regenerate from scratch">
            <Button variant="ghost" size="sm" onClick={onRegenerate} className="h-7 gap-1 px-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </Button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

interface SummaryContentProps {
  content: string;
  isStreaming: boolean;
  isLoading: boolean;
  onGenerate(): void;
  onSourceClick(path: string, line?: number): void;
}

function SummaryContent({
  content,
  isStreaming,
  isLoading,
  onGenerate,
  onSourceClick,
}: SummaryContentProps) {
  if (content) {
    return (
      <Markdown
        className="rev-summary text-sm"
        onSourceClick={onSourceClick}
        severityBadges
      >
        {content}
      </Markdown>
    );
  }

  if (isStreaming || isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader label="Reading changes…" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <ScrollText className="h-10 w-10 text-muted-foreground" />
      <div className="max-w-md text-sm text-muted-foreground">
        A sectioned overview of what this change does — with clickable links into
        the code — plus an audit of what’s worth checking.
      </div>
      <Button onClick={onGenerate} className="gap-1.5">
        <Sparkles className="h-4 w-4" />
        Generate summary
      </Button>
    </div>
  );
}
