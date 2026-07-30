"use client";

/**
 * Always-mounted bottom-right chat surface (same pattern as ModalRoot). The
 * launcher and the panel are one element: a single shell that GSAP grows from the
 * gecko square into the panel and collapses back on close, rather than two
 * separate floating widgets. The two contents cross-fade on a CSS transition
 * keyed off `open` — React owns that so it can't desync from the shape tween. It
 * also reads the diff viewer's selection anchor so a live highlight can be
 * surfaced as attachable context, and keeps the chat's scope in sync with the
 * route — rendering nothing on routes with no code on screen, where there would be
 * nothing to ask about.
 */

import { useMemo, useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { useSelectionMenu } from "@/features/diff-viewer/selection-menu.store";
import { useChatStore } from "./chat.store";
import { useChatScope } from "./useChatScope";
import { useChatHistorySync } from "@/hooks/useChatHistory";
import { ChatLauncher } from "./ChatLauncher";
import { ChatPanel } from "./ChatPanel";
import { scopeHasCode, type ChatAttachment } from "@/domain/chat/models";

const BUTTON_SIZE = 48;
const PANEL_WIDTH = 420;
const PANEL_HEIGHT = 620;

function panelSize(): { width: number; height: number } {
  return {
    width: Math.min(PANEL_WIDTH, window.innerWidth - 24),
    height: Math.min(PANEL_HEIGHT, window.innerHeight * 0.72),
  };
}

export function ChatRoot() {
  useChatScope();
  useChatHistorySync();
  const open = useChatStore((s) => s.open);
  const staged = useChatStore((s) => s.staged);
  const scope = useChatStore((s) => s.scope);
  const anchor = useSelectionMenu((s) => s.anchor);

  const shellRef = useRef<HTMLDivElement | null>(null);

  const liveSelection = useMemo<ChatAttachment | null>(() => {
    if (!anchor) return null;
    const { path, startLine, endLine, selectedText } = anchor;
    return {
      id: `sel-${path}-${startLine}-${endLine}`,
      kind: "selection",
      path,
      startLine,
      endLine,
      text: selectedText,
    };
  }, [anchor]);

  const available = scopeHasCode(scope);
  const highlight = !open && (liveSelection !== null || staged.length > 0);

  useGSAP(
    () => {
      const shell = shellRef.current;
      if (!shell) return;
      if (open) {
        const { width, height } = panelSize();
        gsap.to(shell, {
          width,
          height,
          borderRadius: 12,
          duration: 0.4,
          ease: "back.out(1.4)",
        });
        return;
      }
      gsap.to(shell, {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: 14,
        duration: 0.34,
        ease: "power3.inOut",
      });
    },
    { dependencies: [open] },
  );

  if (!available) return null;

  return (
    <div className="pointer-events-none fixed bottom-16 right-3 z-50 flex justify-end">
      <div
        ref={shellRef}
        style={{ width: BUTTON_SIZE, height: BUTTON_SIZE, borderRadius: 14 }}
        className={cn(
          "pointer-events-auto relative overflow-hidden border bg-background shadow-2xl shadow-black/60 transition-colors",
          highlight && "border-red-500/60",
          !highlight && "border-neutral-700",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-200",
            open && "opacity-100 delay-100",
            !open && "pointer-events-none opacity-0",
          )}
          aria-hidden={!open}
        >
          <ChatPanel liveSelection={liveSelection} interactive={open} />
        </div>
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-150",
            open && "pointer-events-none opacity-0",
            !open && "opacity-100 delay-150",
          )}
        >
          <ChatLauncher hasSelection={liveSelection !== null} interactive={!open} />
        </div>
      </div>
    </div>
  );
}
