"use client";

/**
 * Right-click card menu. On open, a blurred backdrop covers the page, the card
 * lifts (scale + shadow), and the actions slide out to the right of the card
 * (flipping to the left if there's no room). Actions are plain icon+label rows —
 * light gray, recoloring on hover. Any click outside, Escape, or an action closes
 * it with a short exit animation.
 */

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { useCardMenuStore, closeCardMenu } from "./store";
import type { CardAction, CardMenuRect } from "./types";

const GAP = 28;
const MENU_WIDTH = 200;
const ROW_HEIGHT = 34;
const MARGIN = 12;

export function CardMenuOverlay() {
  const active = useCardMenuStore((s) => s.active);
  if (!active) return null;
  return (
    <CardMenuContent
      key={active.id}
      rect={active.rect}
      preview={active.preview}
      actions={active.actions}
    />
  );
}

interface CardMenuContentProps {
  rect: CardMenuRect;
  preview: React.ReactNode;
  actions: CardAction[];
}

function menuPosition(rect: CardMenuRect, count: number) {
  const spillRight = rect.left + rect.width + GAP + MENU_WIDTH;
  const placeLeft = spillRight > window.innerWidth - MARGIN;
  const left = placeLeft ? rect.left - GAP - MENU_WIDTH : rect.left + rect.width + GAP;
  const height = count * ROW_HEIGHT;
  const centered = rect.top + rect.height / 2 - height / 2;
  const top = Math.max(MARGIN, Math.min(centered, window.innerHeight - height - MARGIN));
  return { left: Math.max(MARGIN, left), top };
}

function CardMenuContent({ rect, preview, actions }: CardMenuContentProps) {
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closing = useRef(false);

  const handleClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const tl = gsap.timeline({ onComplete: closeCardMenu });
    if (menuRef.current) {
      tl.to(menuRef.current.children, { opacity: 0, x: -6, duration: 0.1, stagger: 0.02 }, 0);
    }
    tl.to(cardRef.current, { scale: 1, duration: 0.14, ease: "power2.in" }, 0);
    tl.to(backdropRef.current, { opacity: 0, duration: 0.14 }, 0);
  }, []);

  useLayoutEffect(() => {
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.out" });
    gsap.fromTo(cardRef.current, { scale: 1 }, { scale: 1.04, duration: 0.3, ease: "back.out(1.6)" });
    if (menuRef.current) {
      gsap.fromTo(
        menuRef.current.children,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.28, stagger: 0.045, ease: "power3.out", delay: 0.06 },
      );
    }
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);

  const pos = menuPosition(rect, actions.length);

  return createPortal(
    <div className="fixed inset-0 z-[90]" onMouseDown={handleClose}>
      <div ref={backdropRef} className="absolute inset-0 bg-black/40 backdrop-blur-md" />

      <div
        ref={cardRef}
        style={{ top: rect.top, left: rect.left, width: rect.width }}
        className="pointer-events-none fixed rounded-xl shadow-2xl shadow-black/60"
      >
        {preview}
      </div>

      <div
        ref={menuRef}
        style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
        className="fixed flex flex-col items-start gap-0.5"
      >
        {actions.map((action) => (
          <ActionRow key={action.id} action={action} onClose={handleClose} />
        ))}
      </div>
    </div>,
    document.body,
  );
}

interface ActionRowProps {
  action: CardAction;
  onClose(): void;
}

function ActionRow({ action, onClose }: ActionRowProps) {
  const Icon = action.icon;

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();
  const handleClick = () => {
    action.onSelect();
    onClose();
  };

  return (
    <button
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2.5 whitespace-nowrap py-1.5 text-sm text-neutral-300 transition-colors",
        action.accent ?? "hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{action.label}</span>
    </button>
  );
}
