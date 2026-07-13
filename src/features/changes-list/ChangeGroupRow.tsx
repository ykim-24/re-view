"use client";

/** One change group (a run of added or removed lines); clicking scrolls the diff to it. */

import { Plus, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/Tooltip";
import type { ChangeGroup } from "@/domain/pull-request/changes";

const GROUP_STYLE: Record<
  ChangeGroup["type"],
  { Icon: LucideIcon; color: string; label: string }
> = {
  added: { Icon: Plus, color: "text-emerald-400", label: "Added" },
  removed: { Icon: Minus, color: "text-red-400", label: "Removed" },
};

function plural(n: number): string {
  if (n === 1) return "1 line";
  return `${n} lines`;
}

interface ChangeGroupRowProps {
  group: ChangeGroup;
  path: string;
  onReveal(path: string, line: number, side: "head" | "base"): void;
}

export function ChangeGroupRow({ group, path, onReveal }: ChangeGroupRowProps) {
  const { Icon, color, label } = GROUP_STYLE[group.type];
  const handleClick = () => onReveal(path, group.startLine, group.side);

  return (
    <Tooltip content={`Go to line ${group.startLine}`} className="block">
      <button
        onClick={handleClick}
        className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-muted/50"
      >
        <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", color)} />
        <div className="min-w-0 flex-1">
          <div className="text-xs">
            <span className={color}>
              {label} {plural(group.lineCount)}
            </span>
            <span className="ml-1 text-muted-foreground">
              · line {group.startLine}
            </span>
          </div>
          {group.preview && (
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {group.preview}
            </div>
          )}
        </div>
      </button>
    </Tooltip>
  );
}
