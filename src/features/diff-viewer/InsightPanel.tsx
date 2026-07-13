"use client";

/**
 * Floating insight UI: the streamed analysis is the main container (blinking
 * cursor / Dig Dug loader while it waits), with a separate "Logs" container
 * below showing the pipeline steps and gathered context. "Dig Deeper" runs a
 * second resolution hop; thumbs up/down records eval feedback.
 */

import { useState } from "react";
import { Shovel, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import { DigLoader } from "./DigLoader";
import { StepLogs } from "./StepLogs";
import type { InsightStep } from "@/hooks/useEventStream";
import type { GatheredFile } from "@/domain/insight/events";

const PANEL = "flex flex-col overflow-hidden rounded-lg border bg-background shadow-2xl";

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function lineLabel(startLine: number, endLine: number): string {
  if (startLine === endLine) return `${startLine}`;
  return `${startLine}–${endLine}`;
}

interface InsightPanelProps {
  path: string;
  startLine: number;
  endLine: number;
  steps: InsightStep[];
  files: GatheredFile[];
  answer: string;
  isStreaming: boolean;
  deep: boolean;
  onRate(rating: "up" | "down"): void;
  onDeeper(): void;
  onClose(): void;
}

export function InsightPanel({
  path,
  startLine,
  endLine,
  steps,
  files,
  answer,
  isStreaming,
  deep,
  onRate,
  onDeeper,
  onClose,
}: InsightPanelProps) {
  return (
    <div className="absolute right-3 top-3 z-30 flex w-[440px] max-w-[85%] flex-col gap-2">
      <div className={cn(PANEL, "min-h-0")}>
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span className="text-xs font-medium">Insight</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {basename(path)}:{lineLabel(startLine, endLine)}
          </span>
          <button
            onClick={onClose}
            className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close insight"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[44vh] min-h-[120px] overflow-y-auto p-3">
          <StreamedAnswer answer={answer} isStreaming={isStreaming} deep={deep} />
        </div>

        {answer && !isStreaming && (
          <div className="flex shrink-0 items-center gap-1.5 border-t px-3 py-1.5">
            <DeeperControl deep={deep} onDeeper={onDeeper} />
            <InsightFeedback onRate={onRate} />
          </div>
        )}
      </div>

      <StepLogs steps={steps} files={files} isStreaming={isStreaming} />
    </div>
  );
}

export function StreamedAnswer({
  answer,
  isStreaming,
  deep,
}: {
  answer: string;
  isStreaming: boolean;
  deep?: boolean;
}) {
  if (!answer && isStreaming && deep) return <DigLoader />;
  if (!answer && isStreaming) {
    return (
      <div className="text-xs">
        <span className="inline-block h-3.5 w-[2px] animate-pulse bg-foreground align-middle" />
      </div>
    );
  }
  return (
    <div className="text-xs">
      <Markdown className="text-xs">{answer}</Markdown>
    </div>
  );
}

interface DeeperControlProps {
  deep: boolean;
  onDeeper(): void;
}

function DeeperControl({ deep, onDeeper }: DeeperControlProps) {
  if (deep) {
    return (
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Shovel className="h-3 w-3" /> Deep context
      </span>
    );
  }
  return (
    <button
      onClick={onDeeper}
      className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-red-500/60 hover:text-red-300"
    >
      <Shovel className="h-3 w-3" /> Dig Deeper
    </button>
  );
}

function InsightFeedback({ onRate }: { onRate(rating: "up" | "down"): void }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);

  const handleUp = () => {
    setRating("up");
    onRate("up");
  };
  const handleDown = () => {
    setRating("down");
    onRate("down");
  };

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Helpful?</span>
      <button
        onClick={handleUp}
        aria-label="Helpful"
        className={cn(
          "rounded p-1 text-muted-foreground hover:bg-muted hover:text-emerald-400",
          rating === "up" && "text-emerald-400",
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={handleDown}
        aria-label="Not helpful"
        className={cn(
          "rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-400",
          rating === "down" && "text-red-400",
        )}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
