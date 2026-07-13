"use client";

/**
 * Spotlight-style file lookup (Cmd/Ctrl+Shift+P): a blurred overlay with a
 * centered input that fuzzy-filters the PR's changed files. Arrow keys navigate,
 * Enter or click opens the file, Escape closes.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { FileDiff, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/features/workspace/store";
import { STATUS_COLOR } from "@/features/dependency-tree/tree";
import type { FileChange } from "@/domain/pull-request/models";

function subsequenceMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx < 0) return "";
  return path.slice(0, idx);
}

interface FileSpotlightProps {
  files: FileChange[];
}

export function FileSpotlight({ files }: FileSpotlightProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selectFile = useWorkspaceStore((s) => s.selectFile);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return files;
    return files.filter((f) => subsequenceMatch(q, f.path));
  }, [files, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const choose = useCallback(
    (path: string) => {
      selectFile(path);
      close();
    },
    [selectFile, close],
  );

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const isCombo =
        (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p";
      if (!isCombo) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setActive(0);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && results[active]) {
      choose(results[active].path);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/40 backdrop-blur-sm"
      onClick={close}
    >
      <SpotlightPanel
        query={query}
        results={results}
        active={active}
        onQueryChange={handleQueryChange}
        onInputKeyDown={handleInputKeyDown}
        onChoose={choose}
        onHover={setActive}
      />
    </div>
  );
}

interface SpotlightPanelProps {
  query: string;
  results: FileChange[];
  active: number;
  onQueryChange(e: ChangeEvent<HTMLInputElement>): void;
  onInputKeyDown(e: KeyboardEvent<HTMLInputElement>): void;
  onChoose(path: string): void;
  onHover(index: number): void;
}

function stop(e: { stopPropagation(): void }) {
  e.stopPropagation();
}

function SpotlightPanel({
  query,
  results,
  active,
  onQueryChange,
  onInputKeyDown,
  onChoose,
  onHover,
}: SpotlightPanelProps) {
  return (
    <div
      className="mt-[18vh] h-fit w-full max-w-xl overflow-hidden rounded-xl border bg-background shadow-2xl"
      onClick={stop}
    >
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={onQueryChange}
          onKeyDown={onInputKeyDown}
          placeholder="Go to changed file…"
          className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div className="max-h-[50vh] overflow-y-auto py-2 px-3">
        {results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No files match
          </div>
        )}
        {results.map((file, i) => (
          <SpotlightResult
            key={file.path}
            file={file}
            index={i}
            active={i === active}
            onChoose={onChoose}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  );
}

interface SpotlightResultProps {
  file: FileChange;
  index: number;
  active: boolean;
  onChoose(path: string): void;
  onHover(index: number): void;
}

function SpotlightResult({
  file,
  index,
  active,
  onChoose,
  onHover,
}: SpotlightResultProps) {
  const handleClick = () => onChoose(file.path);
  const handleHover = () => onHover(index);
  const dir = dirname(file.path);

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleHover}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
        active && "bg-muted",
      )}
    >
      <FileDiff
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          STATUS_COLOR[file.status] ?? "text-muted-foreground",
        )}
      />
      <span className="truncate">{basename(file.path)}</span>
      {dir && (
        <span className="truncate text-xs text-muted-foreground">{dir}</span>
      )}
    </button>
  );
}
