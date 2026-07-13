"use client";

/**
 * Lightweight custom tooltip. Renders into document.body via a portal at a very
 * high z-index so it floats above editors, panels, and overlays. Positioned just
 * above the trigger using viewport coordinates (position: fixed).
 */

import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

interface Anchor {
  /** trigger rect, used to position + flip the bubble within the viewport */
  rectTop: number;
  rectBottom: number;
  center: number;
}

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** wrapper display/layout classes; defaults to inline-flex (override for rows). */
  className?: string;
}

export function Tooltip({ content, children, className }: TooltipProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setAnchor({ rectTop: r.top, rectBottom: r.bottom, center: r.left + r.width / 2 });
  };
  const hide = () => setAnchor(null);

  const handleFocus = (e: FocusEvent) => {
    void e;
    show();
  };

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={handleFocus}
      onBlur={hide}
      className={className ?? "inline-flex"}
    >
      {children}
      {anchor && <TooltipBubble anchor={anchor} content={content} />}
    </span>
  );
}

const MARGIN = 6;

function TooltipBubble({ anchor, content }: { anchor: Anchor; content: ReactNode }) {
  const bubbleRef = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer above the trigger; flip below if it would clip the top.
    let top = anchor.rectTop - MARGIN - height;
    if (top < MARGIN) top = anchor.rectBottom + MARGIN;
    top = Math.min(top, vh - height - MARGIN);

    // Center horizontally, clamped to the viewport.
    let left = anchor.center - width / 2;
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));

    setPos({ top, left });
  }, [anchor]);

  return createPortal(
    <span
      ref={bubbleRef}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 9999,
      }}
      className="pointer-events-none max-w-xs whitespace-pre-line break-words rounded-md border bg-popover px-2 py-1 text-xs leading-snug text-popover-foreground shadow-lg"
    >
      {content}
    </span>,
    document.body,
  );
}
