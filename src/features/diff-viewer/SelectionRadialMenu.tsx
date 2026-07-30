"use client";

/**
 * Persona-style action wheel shown when lines are selected in the diff. A
 * decorative gradient-black hub sits on the cursor; labelled action pills fan out
 * around it and spring in (GSAP). Comment stages an inline review note; Insight
 * asks Claude about the snippet; Ask Question opens the chat with the selection
 * attached. Built to take more segments later.
 */

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  MessageCircleQuestion,
  MessageSquarePlus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectionRadialMenuProps {
  top: number;
  left: number;
  showComment?: boolean;
  onComment(): void;
  onInsight(): void;
  onAsk(): void;
}

interface RadialActionDescriptor {
  key: string;
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  accent: string;
  onClick(): void;
}

const ARC_RADIUS_X = 30;
const ARC_RADIUS_Y = 42;
const ARC_SPREAD = 55;

/**
 * Where a pill sits on the arc around the hub: the middle one reaches furthest
 * right and the outer ones swing back toward the cursor, so the set wraps the hub
 * instead of stacking. The arc is an ellipse — a tighter horizontal radius tucks
 * the pills in against the hub (while still clearing it, so none crosses its
 * center) and a taller vertical one keeps the rows from touching.
 */
function arcOffset(index: number, count: number): string {
  const step = count > 1 ? (ARC_SPREAD * 2) / (count - 1) : 0;
  const angle = -ARC_SPREAD + step * index;
  const radians = (angle * Math.PI) / 180;
  const x = Math.round(ARC_RADIUS_X * Math.cos(radians));
  const y = Math.round(ARC_RADIUS_Y * Math.sin(radians));
  return `translate(${x}px, -50%) translate(0, ${y}px)`;
}

export function SelectionRadialMenu({
  top,
  left,
  showComment = true,
  onComment,
  onInsight,
  onAsk,
}: SelectionRadialMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const nodes = ref.current?.querySelectorAll(".radial-pop");
      if (!nodes || nodes.length === 0) return;
      gsap.from(nodes, {
        scale: 0,
        opacity: 0,
        duration: 0.28,
        ease: "back.out(2.2)",
        stagger: 0.05,
      });
    },
    { scope: ref },
  );

  const commentAction: RadialActionDescriptor = {
    key: "comment",
    icon: MessageSquarePlus,
    label: "Comment",
    shortcut: "⌘K",
    accent: "hover:border-sky-400/70 hover:text-sky-300",
    onClick: onComment,
  };
  const insightAction: RadialActionDescriptor = {
    key: "insight",
    icon: Sparkles,
    label: "Insight",
    shortcut: "⌘I",
    accent: "hover:border-red-500/80 hover:text-red-300",
    onClick: onInsight,
  };
  const askAction: RadialActionDescriptor = {
    key: "ask",
    icon: MessageCircleQuestion,
    label: "Ask Question",
    accent: "hover:border-amber-400/80 hover:text-amber-300",
    onClick: onAsk,
  };
  const actions: RadialActionDescriptor[] = [insightAction, askAction];
  if (showComment) actions.unshift(commentAction);

  return (
    <div ref={ref} style={{ top, left }} className="absolute z-20">
      <RadialHub />
      {actions.map((action, index) => (
        <RadialNode
          key={action.key}
          action={action}
          offset={arcOffset(index, actions.length)}
        />
      ))}
    </div>
  );
}

function RadialHub() {
  return (
    <div
      style={{ transform: "translate(-50%, -50%)" }}
      className="absolute left-0 top-0"
    >
      <div className="radial-pop flex h-8 w-8 items-center justify-center rounded-full border border-neutral-700 bg-gradient-to-b from-neutral-700 to-neutral-950 shadow-lg shadow-black/50">
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-500/70" />
      </div>
    </div>
  );
}

function RadialNode({
  action,
  offset,
}: {
  action: RadialActionDescriptor;
  offset: string;
}) {
  const Icon = action.icon;
  return (
    <div style={{ transform: offset }} className="absolute left-0 top-0">
      <button
        onClick={action.onClick}
        className={cn(
          "radial-pop flex items-center gap-1.5 whitespace-nowrap rounded-md border border-neutral-700 bg-gradient-to-b from-neutral-700 to-neutral-950 px-2 py-1 text-xs font-medium text-neutral-200 shadow-lg shadow-black/50 transition-colors",
          action.accent,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{action.label}</span>
        {action.shortcut && (
          <kbd className="rounded bg-black/40 px-1 text-[10px] text-neutral-400">
            {action.shortcut}
          </kbd>
        )}
      </button>
    </div>
  );
}
