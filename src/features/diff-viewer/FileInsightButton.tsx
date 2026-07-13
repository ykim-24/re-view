"use client";

/** Header button that runs an AI insight over the whole file (not a selection). */

import { Sparkles } from "lucide-react";
import { Tooltip } from "@/components/Tooltip";
import { useInsightStore } from "./insight.store";

interface FileInsightButtonProps {
  owner: string;
  repo: string;
  headRef: string;
  path: string;
}

export function FileInsightButton({
  owner,
  repo,
  headRef,
  path,
}: FileInsightButtonProps) {
  const open = useInsightStore((s) => s.open);

  const handleClick = () => {
    open({
      owner,
      repo,
      headRef,
      path,
      startLine: 1,
      endLine: 1,
      selectedText: "",
      whole: true,
    });
  };

  return (
    <Tooltip content="Insight for this file">
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:border-red-500/50 hover:text-red-300"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Insight
      </button>
    </Tooltip>
  );
}
