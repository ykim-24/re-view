"use client";

/**
 * The "add component" palette: a modal with a tab per category and a preview pane
 * that shows a live render of the components in the active category. Picking one
 * reports its type to the caller (which creates it) and closes the modal.
 */

import { useLayoutEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ComponentType } from "@/domain/integration/models";
import {
  COMPONENT_CATALOG,
  COMPONENT_CATEGORIES,
  type ComponentCategory,
  type ComponentSpec,
} from "./component-catalog";

interface ComponentPaletteModalProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  onPick(type: ComponentType): void;
}

export function ComponentPaletteModal({ open, onOpenChange, onPick }: ComponentPaletteModalProps) {
  const [tab, setTab] = useState<ComponentCategory>(COMPONENT_CATEGORIES[0]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const specs = COMPONENT_CATALOG.filter((spec) => spec.category === tab);

  useLayoutEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-category="${tab}"]`);
    if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [tab, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex min-h-[32rem] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add a component</DialogTitle>
          <DialogDescription>Pick a component to place in this flow.</DialogDescription>
        </DialogHeader>

        <div ref={listRef} role="tablist" className="relative flex gap-1 border-b">
          {COMPONENT_CATEGORIES.map((category) => (
            <PaletteTab
              key={category}
              category={category}
              active={category === tab}
              onSelect={setTab}
            />
          ))}
          <span
            aria-hidden
            style={{ left: indicator.left, width: indicator.width }}
            className="pointer-events-none absolute bottom-0 h-0.5 rounded bg-blue-500 transition-all duration-200 ease-out"
          />
        </div>

        <div className="grid min-h-0 flex-1 content-start gap-3 pt-1 sm:grid-cols-2">
          {specs.map((spec) => (
            <PaletteItem key={spec.type} spec={spec} onPick={onPick} />
          ))}
          {specs.length === 0 && (
            <div className="col-span-full flex items-center justify-center text-sm text-muted-foreground">
              No components in this category yet.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PaletteTabProps {
  category: ComponentCategory;
  active: boolean;
  onSelect(category: ComponentCategory): void;
}

function PaletteTab({ category, active, onSelect }: PaletteTabProps) {
  const handleClick = () => onSelect(category);
  return (
    <button
      role="tab"
      aria-selected={active}
      data-category={category}
      onClick={handleClick}
      className={cn(
        "px-3 py-2 text-sm transition-colors",
        active && "text-foreground",
        !active && "text-muted-foreground hover:text-foreground",
      )}
    >
      {category}
    </button>
  );
}

interface PaletteItemProps {
  spec: ComponentSpec;
  onPick(type: ComponentType): void;
}

function PaletteItem({ spec, onPick }: PaletteItemProps) {
  const handlePick = () => onPick(spec.type);
  return (
    <button
      onClick={handlePick}
      className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-left hover:border-blue-500/50 hover:bg-muted/50"
    >
      <span className="flex min-h-14 items-center justify-center rounded-md bg-tab-strip/40 p-3">
        <ComponentPreview spec={spec} />
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{spec.label}</span>
        <span className="block text-xs text-muted-foreground">{spec.description}</span>
      </span>
    </button>
  );
}

function ComponentPreview({ spec }: { spec: ComponentSpec }) {
  if (spec.type === "button") {
    const label = typeof spec.defaultConfig.label === "string" ? spec.defaultConfig.label : spec.label;
    return (
      <span className="pointer-events-none inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white">
        {label}
      </span>
    );
  }
  const Icon = spec.icon;
  return (
    <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" />
      {spec.label}
    </span>
  );
}
