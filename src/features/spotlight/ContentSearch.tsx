"use client";

/**
 * Content search across the PR's changed files (Cmd/Ctrl+Shift+F): a blurred
 * overlay with an input that greps head content. Arrow keys navigate matches,
 * Enter or click opens the file and reveals the matched line, Escape closes.
 */

import {
  useEffect,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { Search } from "lucide-react";
import { Loader } from "@/components/Loader";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useSearchFiles } from "@/hooks/useSearchFiles";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { SearchMatch } from "@/application/search-files";

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

interface ContentSearchProps {
  owner: string;
  repo: string;
  headRef: string;
  paths: string[];
}

export function ContentSearch({ owner, repo, headRef, paths }: ContentSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(query, 200);
  const selectFile = useWorkspaceStore((s) => s.selectFile);
  const requestRevealLine = useWorkspaceStore((s) => s.requestRevealLine);

  const search = useSearchFiles(owner, repo, headRef, paths, debounced);
  const matches = search.data?.matches ?? [];

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const combo =
        (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f";
      if (!combo) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  const close = () => {
    setOpen(false);
    setQuery("");
    setActive(0);
  };

  const choose = (match: SearchMatch) => {
    selectFile(match.path);
    requestRevealLine(match.path, match.line, "head");
    close();
  };

  const handleQueryChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setActive(0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, matches.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && matches[active]) {
      choose(matches[active]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center bg-black/40 backdrop-blur-sm"
      onClick={close}
    >
      <Panel
        query={query}
        matches={matches}
        active={active}
        loading={search.isFetching}
        onQueryChange={handleQueryChange}
        onKeyDown={handleKeyDown}
        onChoose={choose}
        onHover={setActive}
      />
    </div>
  );
}

interface PanelProps {
  query: string;
  matches: SearchMatch[];
  active: number;
  loading: boolean;
  onQueryChange(e: ChangeEvent<HTMLInputElement>): void;
  onKeyDown(e: KeyboardEvent<HTMLInputElement>): void;
  onChoose(match: SearchMatch): void;
  onHover(index: number): void;
}

function stop(e: { stopPropagation(): void }) {
  e.stopPropagation();
}

function Panel({
  query,
  matches,
  active,
  loading,
  onQueryChange,
  onKeyDown,
  onChoose,
  onHover,
}: PanelProps) {
  return (
    <div
      className="mt-[14vh] h-fit w-full max-w-2xl overflow-hidden rounded-xl border bg-background shadow-2xl"
      onClick={stop}
    >
      <div className="flex items-center gap-2 border-b px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={onQueryChange}
          onKeyDown={onKeyDown}
          placeholder="Search text in changed files…"
          className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {loading && <Loader size="sm" />}
      </div>
      <div className="max-h-[55vh] overflow-y-auto py-1">
        {query.trim().length >= 2 && matches.length === 0 && !loading && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No matches
          </div>
        )}
        {matches.map((match, i) => (
          <MatchRow
            key={`${match.path}:${match.line}:${i}`}
            match={match}
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

interface MatchRowProps {
  match: SearchMatch;
  index: number;
  active: boolean;
  onChoose(match: SearchMatch): void;
  onHover(index: number): void;
}

function MatchRow({ match, index, active, onChoose, onHover }: MatchRowProps) {
  const handleClick = () => onChoose(match);
  const handleHover = () => onHover(index);
  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleHover}
      className={cn(
        "flex w-full items-baseline gap-2 px-3 py-1.5 text-left",
        active && "bg-muted",
      )}
    >
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {basename(match.path)}:{match.line}
      </span>
      <span className="truncate font-mono text-xs">{match.preview}</span>
    </button>
  );
}
