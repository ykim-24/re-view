"use client";

/**
 * A managed list row for integrations and flows: click to open, double-click (or
 * the right-click menu) to rename inline, and a trash button / menu item to
 * delete. Reuses the shared context-menu registry; deletion is gated by the
 * caller (which opens the confirm modal).
 */

import { useCallback, useState } from "react";
import { Pencil, Trash2, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/Tooltip";
import { openContextMenu } from "@/features/context-menu";

interface EntityRowProps {
  id: string;
  name: string;
  subtitle?: string;
  icon: LucideIcon;
  onOpen(id: string): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
}

export function EntityRow({
  id,
  name,
  subtitle,
  icon: Icon,
  onOpen,
  onRename,
  onDelete,
}: EntityRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const startEditing = useCallback(() => {
    setDraft(name);
    setEditing(true);
  }, [name]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== name) onRename(id, next);
  };

  const handleOpen = () => onOpen(id);
  const handleDoubleClick = () => startEditing();
  const handleDelete = () => onDelete(id);
  const handleDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value);
  const handleDraftFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
  const handleDraftKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
    }
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { id: "rename", label: "Rename", icon: Pencil, onSelect: startEditing },
        {
          id: "delete",
          label: "Delete",
          icon: Trash2,
          destructive: true,
          onSelect: handleDelete,
        },
      ],
    });
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={handleDraftChange}
        onFocus={handleDraftFocus}
        onKeyDown={handleDraftKeyDown}
        onBlur={commit}
        className="h-11 text-sm"
      />
    );
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-muted-foreground hover:border-blue-500/40 hover:bg-muted/50"
    >
      <button
        onClick={handleOpen}
        onDoubleClick={handleDoubleClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Icon className="h-4 w-4 shrink-0 text-blue-400" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{name}</span>
          {subtitle && <span className="block truncate text-xs">{subtitle}</span>}
        </span>
      </button>
      <Tooltip content="Delete">
        <button
          onClick={handleDelete}
          aria-label="Delete"
          className="shrink-0 rounded p-1 text-muted-foreground/60 opacity-0 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  );
}
