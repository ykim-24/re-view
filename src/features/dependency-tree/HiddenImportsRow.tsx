"use client";

/** Hover summary of imports not shown: external packages or untouched by the diff. */

import { Tooltip } from "@/components/Tooltip";
import { indentStyle } from "./tree";

interface HiddenImportsRowProps {
  depth: number;
  hidden: string[];
}

export function HiddenImportsRow({ depth, hidden }: HiddenImportsRowProps) {
  const title = `Not shown (imported but not referenced in the diff, or external packages):\n${hidden.join(
    "\n",
  )}`;

  return (
    <Tooltip content={title} className="block">
      <div
        className="py-1 pr-2 text-[10px] text-muted-foreground/50"
        style={indentStyle(depth)}
      >
        + {hidden.length} other / external (hover)
      </div>
    </Tooltip>
  );
}
