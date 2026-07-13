"use client";

/** A single imported symbol the diff references; clicking opens its definition. */

import { FunctionSquare } from "lucide-react";
import { Tooltip } from "@/components/Tooltip";
import { basename, indentStyle } from "./tree";
import { useTreeContext } from "./TreeContext";

interface UsedSymbolRowProps {
  importerPath: string;
  symbol: string;
  source: string;
  depth: number;
}

export function UsedSymbolRow({
  importerPath,
  symbol,
  source,
  depth,
}: UsedSymbolRowProps) {
  const { goToDefinition } = useTreeContext();

  const handleClick = () => goToDefinition(importerPath, symbol);

  return (
    <Tooltip
      content={`Go to ${symbol} · ${basename(source)}`}
      className="block"
    >
      <div
        className="flex items-center gap-1.5 py-1 pr-2 cursor-pointer hover:bg-muted/40"
        style={indentStyle(depth)}
        onClick={handleClick}
      >
        <FunctionSquare className="h-3.5 w-3.5 shrink-0 text-sky-400" />
        <span className="truncate font-medium">{symbol}</span>
        <span className="ml-auto truncate pl-2 text-[10px] text-muted-foreground/70">
          {basename(source)}
        </span>
      </div>
    </Tooltip>
  );
}
