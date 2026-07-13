"use client";

/**
 * Persona-style action wheel shown when lines are selected in the diff. A
 * decorative gradient-black hub sits on the cursor; labelled action pills fan out
 * around it and spring in (GSAP). Comment stages an inline review note; Insight
 * asks Claude about the snippet. Built to take more segments later.
 */

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { MessageSquarePlus, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectionRadialMenuProps {
  top: number;
  left: number;
  showComment?: boolean;
  onComment(): void;
  onInsight(): void;
}

interface RadialActionDescriptor {
  key: string;
  icon: LucideIcon;
  label: string;
  shortcut: string;
  accent: string;
  offset: string;
  onClick(): void;
}

export function SelectionRadialMenu({
  top,
  left,
  showComment = true,
  onComment,
  onInsight,
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
    offset: "translate(24px, -50%) translate(0, -18px)",
    onClick: onComment,
  };
  const insightAction: RadialActionDescriptor = {
    key: "insight",
    icon: Sparkles,
    label: "Insight",
    shortcut: "⌘I",
    accent: "hover:border-red-500/80 hover:text-red-300",
    offset: showComment
      ? "translate(24px, -50%) translate(0, 18px)"
      : "translate(24px, -50%)",
    onClick: onInsight,
  };
  const actions: RadialActionDescriptor[] = showComment
    ? [commentAction, insightAction]
    : [insightAction];

  return (
    <div ref={ref} style={{ top, left }} className="absolute z-20">
      <RadialHub />
      {actions.map((action) => (
        <RadialNode key={action.key} action={action} />
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

function RadialNode({ action }: { action: RadialActionDescriptor }) {
  const Icon = action.icon;
  return (
    <div style={{ transform: action.offset }} className="absolute left-0 top-0">
      <button
        onClick={action.onClick}
        className={cn(
          "radial-pop flex items-center gap-1.5 whitespace-nowrap rounded-md border border-neutral-700 bg-gradient-to-b from-neutral-700 to-neutral-950 px-2 py-1 text-xs font-medium text-neutral-200 shadow-lg shadow-black/50 transition-colors",
          action.accent,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{action.label}</span>
        <kbd className="rounded bg-black/40 px-1 text-[10px] text-neutral-400">
          {action.shortcut}
        </kbd>
      </button>
    </div>
  );
}
