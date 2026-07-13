"use client";

/**
 * Custom select — no native <select>. The menu renders into document.body via a
 * portal at a high z-index so it floats above everything, positioned under the
 * trigger. Closes on select, outside click, or Escape.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange(value: string): void;
  className?: string;
}

interface MenuRect {
  triggerTop: number;
  triggerBottom: number;
  left: number;
  width: number;
}

export function Select({ value, options, onChange, className }: SelectProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [rect, setRect] = useState<MenuRect | null>(null);

  const selected = options.find((o) => o.value === value);

  const open = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      triggerTop: r.top,
      triggerBottom: r.bottom,
      left: r.left,
      width: r.width,
    });
  };
  const close = () => setRect(null);

  const handleTriggerClick = () => {
    if (rect) close();
    else open();
  };

  const handlePick = (next: string) => {
    onChange(next);
    close();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <span className="truncate">{selected?.label ?? "Select…"}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
      {rect && (
        <SelectMenu
          rect={rect}
          options={options}
          value={value}
          triggerRef={triggerRef}
          onPick={handlePick}
          onClose={close}
        />
      )}
    </>
  );
}

interface SelectMenuProps {
  rect: MenuRect;
  options: SelectOption[];
  value: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onPick(value: string): void;
  onClose(): void;
}

function SelectMenu({
  rect,
  options,
  value,
  triggerRef,
  onPick,
  onClose,
}: SelectMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const { height, width } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 4;
    const margin = 8;

    // Open below; flip above if it would overflow the bottom.
    let top = rect.triggerBottom + gap;
    if (top + height > vh - margin) {
      top = Math.max(margin, rect.triggerTop - gap - height);
    }
    const left = Math.max(margin, Math.min(rect.left, vw - width - margin));
    setCoords({ top, left });
  }, [rect]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Close on an outside click without blocking that click from reaching its
    // target (no full-screen overlay).
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose, triggerRef]);

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: coords?.top ?? -9999,
        left: coords?.left ?? rect.left,
        minWidth: rect.width,
        zIndex: 9999,
      }}
      className="max-h-[50vh] overflow-y-auto rounded-md border bg-popover py-1 text-sm text-popover-foreground shadow-xl"
    >
      {options.map((option) => (
        <SelectItem
          key={option.value}
          option={option}
          selected={option.value === value}
          onPick={onPick}
        />
      ))}
    </div>,
    document.body,
  );
}

interface SelectItemProps {
  option: SelectOption;
  selected: boolean;
  onPick(value: string): void;
}

function SelectItem({ option, selected, onPick }: SelectItemProps) {
  const handleClick = () => onPick(option.value);
  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-2 py-1.5 pl-2.5 pr-8 text-left hover:bg-muted",
        selected && "text-foreground",
        !selected && "text-muted-foreground",
      )}
    >
      <Check className={cn("h-3.5 w-3.5 shrink-0", !selected && "invisible")} />
      <span className="truncate">{option.label}</span>
    </button>
  );
}
