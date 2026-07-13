"use client";

/**
 * Left-pane tree of the PR's changed files grouped by folder. Builds the import
 * graph, exposes it plus navigation actions via context, and renders the folder
 * and file rows. Expanding a file reveals the imported symbols its diff touches.
 */

import { useCallback, useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Tooltip } from "@/components/Tooltip";
import { useResolveSymbol } from "@/hooks/useResolveSymbol";
import { useWorkspaceStore } from "@/features/workspace/store";
import { buildFolderTree, collectDirPaths } from "./tree";
import { TreeProvider, type TreeContextValue } from "./TreeContext";
import { DirRow } from "./DirRow";
import { FileRow } from "./FileRow";
import type { FileChange } from "@/domain/pull-request/models";
import type {
  ResolveSymbolInput,
  ResolveSymbolResult,
} from "@/application/resolve-symbol";

interface DependencyTreeProps {
  owner: string;
  repo: string;
  headRef: string;
  files: FileChange[];
}

function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function DependencyTree({
  owner,
  repo,
  headRef,
  files,
}: DependencyTreeProps) {
  const tree = useMemo(() => buildFolderTree(files), [files]);

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());

  const selectedPath = useWorkspaceStore((s) => s.selectedPath);
  const selectFile = useWorkspaceStore((s) => s.selectFile);
  const openDefinition = useWorkspaceStore((s) => s.openDefinition);
  const setDefinitionResult = useWorkspaceStore((s) => s.setDefinitionResult);
  const setDefinitionError = useWorkspaceStore((s) => s.setDefinitionError);
  const requestReveal = useWorkspaceStore((s) => s.requestReveal);
  const resolve = useResolveSymbol();
  const { mutate: resolveSymbol } = resolve;

  const toggleFile = useCallback(
    (path: string) => setExpandedFiles((prev) => toggle(prev, path)),
    [],
  );
  const toggleDir = useCallback(
    (path: string) => setCollapsedDirs((prev) => toggle(prev, path)),
    [],
  );

  const allDirPaths = useMemo(() => collectDirPaths(tree), [tree]);
  const allCollapsed =
    allDirPaths.length > 0 && allDirPaths.every((p) => collapsedDirs.has(p));

  const handleCollapseAll = () => {
    if (allCollapsed) setCollapsedDirs(new Set());
    else setCollapsedDirs(new Set(allDirPaths));
  };

  const goToDefinition = useCallback(
    (importerPath: string, symbol: string) => {
      selectFile(importerPath);
      requestReveal(importerPath, symbol);
      openDefinition(symbol);
      const input: ResolveSymbolInput = {
        owner,
        repo,
        ref: headRef,
        importerPath,
        symbol,
      };
      resolveSymbol(input, {
        onSuccess: (res: ResolveSymbolResult) => setDefinitionResult(res),
        onError: (err: Error) => setDefinitionError(err.message),
      });
    },
    [
      owner,
      repo,
      headRef,
      selectFile,
      requestReveal,
      openDefinition,
      resolveSymbol,
      setDefinitionResult,
      setDefinitionError,
    ],
  );

  const value: TreeContextValue = useMemo(
    () => ({
      owner,
      repo,
      headRef,
      selectedPath,
      expandedFiles,
      collapsedDirs,
      selectFile,
      toggleFile,
      toggleDir,
      goToDefinition,
    }),
    [
      owner,
      repo,
      headRef,
      selectedPath,
      expandedFiles,
      collapsedDirs,
      selectFile,
      toggleFile,
      toggleDir,
      goToDefinition,
    ],
  );

  return (
    <div className="flex h-full flex-col min-h-0">
      <div className="flex shrink-0 items-center gap-1 border-b px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Changed files
        </span>
        <span className="text-xs text-muted-foreground">{files.length}</span>
        {allDirPaths.length > 0 && (
          <Tooltip
            content={allCollapsed ? "Expand all folders" : "Collapse all folders"}
            className="ml-auto flex"
          >
            <button
              onClick={handleCollapseAll}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <CollapseAllIcon allCollapsed={allCollapsed} />
            </button>
          </Tooltip>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2 text-sm">
        <TreeProvider value={value}>
          {tree.dirs.map((d) => (
            <DirRow key={d.path} dir={d} depth={0} />
          ))}
          {tree.files.map((f) => (
            <FileRow key={f.path} file={f} depth={0} />
          ))}
        </TreeProvider>
      </div>
    </div>
  );
}

function CollapseAllIcon({ allCollapsed }: { allCollapsed: boolean }) {
  if (allCollapsed) return <ChevronsUpDown className="h-3.5 w-3.5" />;
  return <ChevronsDownUp className="h-3.5 w-3.5" />;
}
