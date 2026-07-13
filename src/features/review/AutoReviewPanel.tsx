"use client";

/**
 * Floating panel for the PR-wide auto review: the streamed review is the main
 * container, with a separate "Logs" container below showing the gather steps
 * (reading files, resolving definitions) and the context it pulled.
 */

import { useEffect } from "react";
import { Bot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutoReview } from "@/hooks/useAutoReview";
import { StreamedAnswer } from "@/features/diff-viewer/InsightPanel";
import { StepLogs } from "@/features/diff-viewer/StepLogs";

const PANEL = "flex flex-col overflow-hidden rounded-lg border bg-background shadow-2xl";

interface AutoReviewPanelProps {
  owner: string;
  repo: string;
  number: number;
  onClose(): void;
}

export function AutoReviewPanel({
  owner,
  repo,
  number,
  onClose,
}: AutoReviewPanelProps) {
  const { steps, files, answer, isStreaming, run } = useAutoReview();

  useEffect(() => {
    run({ owner, repo, number });
  }, [owner, repo, number, run]);

  return (
    <div className="absolute right-3 top-3 z-40 flex w-[480px] max-w-[88%] flex-col gap-2">
      <div className={cn(PANEL, "min-h-0")}>
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
          <Bot className="h-4 w-4 shrink-0 text-emerald-400" />
          <span className="text-xs font-medium">Auto review</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            #{number}
          </span>
          <button
            onClick={onClose}
            className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close auto review"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[52vh] min-h-[140px] overflow-y-auto p-3">
          <StreamedAnswer answer={answer} isStreaming={isStreaming} />
        </div>
      </div>

      <StepLogs steps={steps} files={files} isStreaming={isStreaming} />
    </div>
  );
}
