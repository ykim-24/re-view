"use client";

/**
 * Live step tracker for the insight pipeline: each step is pending (gray),
 * running (amber, pulsing, with its logs), or done (green check). Logs are the
 * deterministic gather output — files read, symbols resolved, usages counted.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightStep } from "@/hooks/useInsight";

export function InsightSteps({ steps }: { steps: InsightStep[] }) {
  if (steps.length === 0) return null;
  return (
    <ol className="space-y-1.5">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </ol>
  );
}

function StepRow({ step }: { step: InsightStep }) {
  return (
    <li>
      <div className="flex items-center gap-2">
        <StepDot status={step.status} />
        <span className={cn("text-xs", labelClass(step.status))}>
          {step.label}
        </span>
      </div>
      <StepLogList step={step} />
    </li>
  );
}

function StepLogList({ step }: { step: InsightStep }) {
  if (step.logs.length === 0) return null;
  const expanded = step.status === "running";
  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
      style={{
        gridTemplateRows: expanded ? "1fr" : "0fr",
        opacity: expanded ? 1 : 0,
      }}
    >
      <div className="min-h-0 overflow-hidden">
        <ul className="ml-[6px] mt-0.5 space-y-0.5 border-l border-border pl-3">
          {step.logs.map((log, i) => (
            <li
              key={`${step.id}-${i}`}
              className="font-mono text-[10px] leading-relaxed text-muted-foreground"
            >
              {log}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function labelClass(status: InsightStep["status"]): string {
  if (status === "running") return "font-medium text-amber-300";
  if (status === "done") return "text-foreground";
  return "text-muted-foreground/50";
}

function StepDot({ status }: { status: InsightStep["status"] }) {
  if (status === "done") {
    return <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />;
  }
  return (
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          status === "running" && "animate-pulse bg-amber-400",
          status === "pending" && "bg-muted-foreground/30",
        )}
      />
    </span>
  );
}
