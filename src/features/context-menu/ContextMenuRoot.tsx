"use client";

/**
 * Always-mounted host for the context-menu registry. Renders the open menu into
 * document.body via a portal at a high z-index, positioned at the cursor and
 * flipped/clamped to stay within the viewport. Closes on an outside mousedown,
 * Escape, scroll, or resize.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { useContextMenuStore, closeContextMenu } from "./store";
import type { ContextMenuItem } from "./types";

const MARGIN = 8;

export function ContextMenuRoot() {
  const active = useContextMenuStore((s) => s.active);
  if (!active) return null;
  return <ContextMenuPanel key={active.id} x={active.x} y={active.y} items={active.items} />;
}

interface ContextMenuPanelProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

function ContextMenuPanel({ x, y, items }: ContextMenuPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x;
    if (left + width > vw - MARGIN) left = x - width;
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));

    let top = y;
    if (top + height > vh - MARGIN) top = y - height;
    top = Math.max(MARGIN, Math.min(top, vh - height - MARGIN));

    setPos({ top, left });

    const originX = left < x ? "right" : "left";
    const originY = top < y ? "bottom" : "top";
    el.style.transformOrigin = `${originX} ${originY}`;
    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.94, y: -4 },
      { opacity: 1, scale: 1, y: 0, duration: 0.14, ease: "power2.out" },
    );
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeContextMenu();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") closeContextMenu();
    };
    const onReposition = () => closeContextMenu();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 9999,
      }}
      className="min-w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
    >
      {items.map((item) => (
        <ContextMenuRow key={item.id} item={item} />
      ))}
    </div>,
    document.body,
  );
}

function ContextMenuRow({ item }: { item: ContextMenuItem }) {
  const Icon = item.icon;
  const handleClick = () => {
    closeContextMenu();
    item.onSelect();
  };
  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
        item.destructive && "text-red-400 hover:bg-red-500/10 hover:text-red-400",
        !item.destructive && "text-foreground hover:bg-muted",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{item.label}</span>
    </button>
  );
}
