"use client";

/**
 * Lists the selected file's changes, grouped into contiguous runs and separated
 * into added vs removed. Collapsible, with an All / Added / Removed quick filter.
 * Each group scrolls the diff to where it lives.
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { useWorkspaceStore } from "@/features/workspace/store";
import { parsePatchChanges } from "@/domain/pull-request/changes";
import { ChangeGroupRow } from "./ChangeGroupRow";
import type { FileChange } from "@/domain/pull-request/models";

type ChangeFilter = "all" | "added" | "removed";

const FILTERS: { value: ChangeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "added", label: "Added" },
  { value: "removed", label: "Removed" },
];

interface ChangesPanelProps {
  file: FileChange | null;
}

export function ChangesPanel({ file }: ChangesPanelProps) {
  const requestRevealLine = useWorkspaceStore((s) => s.requestRevealLine);
  const groups = useMemo(() => parsePatchChanges(file?.patch), [file]);
  const [filter, setFilter] = useState<ChangeFilter>("all");

  const counts: Record<ChangeFilter, number> = useMemo(
    () => ({
      all: groups.length,
      added: groups.filter((g) => g.type === "added").length,
      removed: groups.filter((g) => g.type === "removed").length,
    }),
    [groups],
  );

  const visible = useMemo(
    () => groups.filter((g) => filter === "all" || g.type === filter),
    [groups, filter],
  );

  return (
    <CollapsibleSection title="Changes" count={groups.length} className="border-t-2">

      <div className="flex gap-1 px-3 py-2">
        {FILTERS.map((f) => (
          <FilterTab
            key={f.value}
            value={f.value}
            label={f.label}
            count={counts[f.value]}
            active={filter === f.value}
            onSelect={setFilter}
          />
        ))}
      </div>

      <div className="h-[24vh] overflow-y-auto border-t py-1">
        {!file && <EmptyHint text="Select a file to see its changes" />}
        {file && visible.length === 0 && <EmptyHint text="No changes match" />}
        {file &&
          visible.map((group, i) => (
            <ChangeGroupRow
              key={`${group.type}:${group.startLine}:${i}`}
              group={group}
              path={file.path}
              onReveal={requestRevealLine}
            />
          ))}
      </div>
    </CollapsibleSection>
  );
}

interface FilterTabProps {
  value: ChangeFilter;
  label: string;
  count: number;
  active: boolean;
  onSelect(value: ChangeFilter): void;
}

function FilterTab({ value, label, count, active, onSelect }: FilterTabProps) {
  const handleClick = () => onSelect(value);
  return (
    <button
      onClick={handleClick}
      className={cn(
        "rounded-md px-2 py-0.5 text-xs",
        active && "bg-primary text-primary-foreground",
        !active && "text-muted-foreground hover:bg-muted",
      )}
    >
      {label} {count}
    </button>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
