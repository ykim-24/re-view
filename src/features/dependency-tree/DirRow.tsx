"use client";

/** A folder row grouping changed files; collapsible, renders nested dirs and files. */

import { ChevronRight, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/Tooltip";
import { countFiles, indentStyle, type DirNode } from "./tree";
import { useTreeContext } from "./TreeContext";
import { FileRow } from "./FileRow";

interface DirRowProps {
  dir: DirNode;
  depth: number;
}

export function DirRow({ dir, depth }: DirRowProps) {
  const { collapsedDirs, toggleDir } = useTreeContext();
  const collapsed = collapsedDirs.has(dir.path);

  const handleToggle = () => toggleDir(dir.path);

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 pr-2 cursor-pointer hover:bg-muted/40"
        style={indentStyle(depth)}
        onClick={handleToggle}
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground",
            !collapsed && "rotate-90",
          )}
        />
        <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <Tooltip content={dir.path} className="flex min-w-0">
          <span className="truncate text-muted-foreground">{dir.name}</span>
        </Tooltip>
        <span className="ml-auto shrink-0 pl-2 text-[10px] text-muted-foreground/60">
          {countFiles(dir)}
        </span>
      </div>
      {!collapsed && <DirChildren dir={dir} depth={depth + 1} />}
    </div>
  );
}

interface DirChildrenProps {
  dir: DirNode;
  depth: number;
}

function DirChildren({ dir, depth }: DirChildrenProps) {
  return (
    <>
      {dir.dirs.map((d) => (
        <DirRow key={d.path} dir={d} depth={depth} />
      ))}
      {dir.files.map((f) => (
        <FileRow key={f.path} file={f} depth={depth} />
      ))}
    </>
  );
}
