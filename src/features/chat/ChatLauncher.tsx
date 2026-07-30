"use client";

/**
 * The gecko face of the bottom-right shell: fills it while collapsed and fades out
 * as ChatRoot grows the shell into the panel. It stays mounted underneath the open
 * panel for the collapse animation, so ChatRoot passes `interactive`, which makes it
 * inert and drops the tooltip (an inert trigger never sees the mouseleave that would
 * hide it). Anything that needs to draw at the edge — the highlight border — belongs
 * to the shell instead, since the shell clips its contents to animate.
 */

import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/Tooltip";
import { useChatStore } from "./chat.store";

interface ChatLauncherProps {
  hasSelection: boolean;
  interactive: boolean;
}

export function ChatLauncher({ hasSelection, interactive }: ChatLauncherProps) {
  if (!interactive) return <LauncherFace inert />;
  return (
    <Tooltip
      className="absolute inset-0 block"
      content={<LauncherTip hasSelection={hasSelection} />}
    >
      <LauncherFace />
    </Tooltip>
  );
}

function LauncherFace({ inert }: { inert?: boolean }) {
  const isStreaming = useChatStore((s) => s.isStreaming);
  const openChat = useChatStore((s) => s.openChat);

  const handleOpen = () => openChat();

  return (
    <button
      onClick={handleOpen}
      aria-label="Ask Lizard"
      tabIndex={inert ? -1 : 0}
      aria-hidden={inert}
      className={cn(
        "relative flex h-full w-full items-center justify-center rounded-[14px] bg-gradient-to-b from-neutral-700 to-neutral-950",
        inert && "pointer-events-none",
        !inert && "pointer-events-auto",
      )}
    >
      <Image
        src="/gecko.png?v=2"
        alt=""
        width={30}
        height={30}
        unoptimized
        className="h-[30px] w-[30px] object-contain drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
      />
      <WorkingGlow active={isStreaming && !inert} />
    </button>
  );
}

function LauncherTip({ hasSelection }: { hasSelection: boolean }) {
  if (hasSelection) return <span>Ask about the highlighted code</span>;
  return (
    <span className="flex items-center gap-1">
      <MessageCircle className="h-3 w-3" /> Ask Lizard
    </span>
  );
}

function WorkingGlow({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="absolute inset-0 animate-pulse rounded-[14px] bg-red-500/15 shadow-[inset_0_0_12px_rgba(239,68,68,0.45)]" />
  );
}
