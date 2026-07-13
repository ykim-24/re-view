"use client";

/**
 * Collapsible "Logs" container shared by the insight and auto-review panels:
 * shows the pipeline steps + the gathered context files, and auto-collapses to a
 * one-line summary (height + opacity animated) once the run finishes.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { InsightSteps } from "./InsightSteps";
import type { InsightStep } from "@/hooks/useEventStream";
import type { GatheredFile } from "@/domain/insight/events";

const PANEL = "flex flex-col overflow-hidden rounded-lg border bg-background shadow-2xl";

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

interface StepLogsProps {
  steps: InsightStep[];
  files: GatheredFile[];
  isStreaming: boolean;
}

export function StepLogs({ steps, files, isStreaming }: StepLogsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [prevStreaming, setPrevStreaming] = useState(isStreaming);
  if (prevStreaming !== isStreaming) {
    setPrevStreaming(isStreaming);
    setCollapsed(!isStreaming);
  }

  const handleToggle = () => setCollapsed((c) => !c);

  if (steps.length === 0) return null;
  const done = steps.filter((s) => s.status === "done").length;

  return (
    <div className={cn(PANEL, "shrink-0")}>
      <button
        onClick={handleToggle}
        className="flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground hover:text-foreground"
      >
        <Chevron collapsed={collapsed} />
        Logs
        <span className="font-normal text-muted-foreground/60">
          · {done}/{steps.length} steps · {files.length} files
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{
          gridTemplateRows: collapsed ? "0fr" : "1fr",
          opacity: collapsed ? 0 : 1,
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-[30vh] min-h-[80px] space-y-2 overflow-y-auto px-2.5 pb-2.5">
            <InsightSteps steps={steps} />
            <GatheredFiles files={files} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Chevron({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return <ChevronRight className="h-3.5 w-3.5 shrink-0" />;
  return <ChevronDown className="h-3.5 w-3.5 shrink-0" />;
}

function GatheredFiles({ files }: { files: GatheredFile[] }) {
  if (files.length === 0) return null;
  return (
    <div className="border-t pt-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Context · {files.length} files
      </div>
      <ul className="space-y-0.5">
        {files.map((file) => (
          <li
            key={`${file.path}:${file.reason}`}
            className="flex items-baseline gap-1.5 text-[11px]"
          >
            <span className="font-mono text-foreground">{basename(file.path)}</span>
            <span className="truncate text-muted-foreground">{file.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
