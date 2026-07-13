"use client";

/**
 * A changed-file row. When expanded it lists the imported symbols the diff
 * references (each opening its definition) plus a hover summary of what's hidden.
 */

import type { MouseEvent } from "react";
import { Check, ChevronRight, FileDiff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/Tooltip";
import { Loader } from "@/components/Loader";
import { isCodeIntelPath } from "@/lib/language";
import {
  basename,
  fileImportsView,
  indentStyle,
  STATUS_COLOR,
  type FileImportsView,
} from "./tree";
import { useTreeContext } from "./TreeContext";
import { UsedSymbolRow } from "./UsedSymbolRow";
import { HiddenImportsRow } from "./HiddenImportsRow";
import { useReviewStore } from "@/features/review/store";
import { useFileGraph } from "@/hooks/useFileGraph";
import type { FileChange } from "@/domain/pull-request/models";

interface FileRowProps {
  file: FileChange;
  depth: number;
}

export function FileRow({ file, depth }: FileRowProps) {
  const {
    owner,
    repo,
    headRef,
    selectedPath,
    expandedFiles,
    selectFile,
    toggleFile,
  } = useTreeContext();

  const viewed = useReviewStore((s) => s.viewedFiles.has(file.path));

  const isOpen = expandedFiles.has(file.path);
  const isSelected = selectedPath === file.path;
  const canExpand = isCodeIntelPath(file.path);

  const graph = useFileGraph(
    owner,
    repo,
    headRef,
    file.path,
    file.patch,
    isOpen && canExpand,
  );
  const view = fileImportsView(
    graph.data?.edges ?? [],
    graph.data?.unresolved[file.path] ?? [],
  );

  const handleSelect = () => selectFile(file.path);
  const handleToggle = (e: MouseEvent) => {
    e.stopPropagation();
    toggleFile(file.path);
  };

  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-1 py-1 pr-2 cursor-pointer hover:bg-muted/60",
          isSelected && "bg-muted",
        )}
        style={indentStyle(depth)}
        onClick={handleSelect}
      >
        <button
          onClick={handleToggle}
          className={cn(
            "shrink-0 rounded p-0.5 hover:bg-muted",
            !canExpand && "invisible",
          )}
          aria-label="Toggle imports"
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
          />
        </button>
        <FileDiff
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            STATUS_COLOR[file.status] ?? "text-muted-foreground",
          )}
        />
        <Tooltip content={file.path} className="flex min-w-0">
          <span
            className={cn(
              "truncate",
              viewed && "text-muted-foreground line-through",
            )}
          >
            {basename(file.path)}
          </span>
        </Tooltip>
        {viewed && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />}
        <span className="ml-auto shrink-0 pl-2 text-[10px] tabular-nums text-muted-foreground">
          <span className="text-emerald-400">+{file.additions}</span>{" "}
          <span className="text-red-400">-{file.deletions}</span>
        </span>
      </div>

      {isOpen && (
        <FileImports
          path={file.path}
          depth={depth + 1}
          view={view}
          isLoading={graph.isLoading}
          isError={graph.isError}
        />
      )}
    </div>
  );
}

interface FileImportsProps {
  path: string;
  depth: number;
  view: FileImportsView;
  isLoading: boolean;
  isError: boolean;
}

function FileImports({ path, depth, view, isLoading, isError }: FileImportsProps) {
  if (isLoading) {
    return (
      <div
        className="flex items-center gap-2 py-1 pr-2 text-[10px] text-muted-foreground"
        style={indentStyle(depth)}
      >
        <Loader size="sm" /> Resolving imports…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="py-1 pr-2 text-[10px] text-destructive"
        style={indentStyle(depth)}
      >
        Couldn’t resolve imports.
      </div>
    );
  }

  if (view.used.length === 0 && view.hidden.length === 0) {
    return (
      <div
        className="py-1 pr-2 text-[10px] text-muted-foreground/60"
        style={indentStyle(depth)}
      >
        No imports referenced.
      </div>
    );
  }

  return (
    <>
      {view.used.length > 0 && (
        <div
          className="py-0.5 pr-2 text-[10px] uppercase tracking-wide text-muted-foreground/60"
          style={indentStyle(depth)}
        >
          used in this PR ({view.used.length})
        </div>
      )}
      {view.used.map((u) => (
        <UsedSymbolRow
          key={`${path}->${u.source}#${u.sym}`}
          importerPath={path}
          symbol={u.sym}
          source={u.source}
          depth={depth}
        />
      ))}
      {view.hidden.length > 0 && (
        <HiddenImportsRow depth={depth} hidden={view.hidden} />
      )}
    </>
  );
}
