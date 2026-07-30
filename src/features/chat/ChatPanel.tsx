"use client";

/**
 * The chat panel's contents: header, transcript, composer. It fills the shell
 * ChatRoot animates (so it owns no size, border, or shadow of its own) and goes
 * inert while that shell is collapsed to the button. Auto-scrolls to the newest
 * turn while an answer streams.
 */

import { useEffect, useRef } from "react";
import { Eraser, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChat } from "@/hooks/useChat";
import { useEraseChat } from "@/hooks/useChatHistory";
import { useChatStore } from "./chat.store";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatComposer } from "./ChatComposer";
import type { ChatAttachment } from "@/domain/chat/models";

interface ChatPanelProps {
  liveSelection: ChatAttachment | null;
  interactive: boolean;
}

export function ChatPanel({ liveSelection, interactive }: ChatPanelProps) {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const close = useChatStore((s) => s.close);
  const erase = useEraseChat();
  const { send, stop } = useChat();

  const endRef = useRef<HTMLDivElement | null>(null);
  const lastText = messages[messages.length - 1]?.text ?? "";

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lastText]);

  const handleSend = (question: string) => {
    void send(question);
  };

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col overflow-hidden",
        interactive && "pointer-events-auto",
        !interactive && "pointer-events-none",
      )}
    >
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <span className="text-xs font-medium">Ask Lizard</span>
        <ClearButton onClear={erase} disabled={messages.length === 0} />
        <button
          onClick={close}
          aria-label="Close chat"
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <ChatEmptyState visible={messages.length === 0} />
        {messages.map((message) => (
          <ChatMessageItem
            key={message.id}
            message={message}
            isStreaming={isStreaming}
          />
        ))}
        <div ref={endRef} />
      </div>

      <ChatComposer
        liveSelection={liveSelection}
        onSend={handleSend}
        onStop={stop}
      />
    </div>
  );
}

function ClearButton({
  onClear,
  disabled,
}: {
  onClear(): void;
  disabled: boolean;
}) {
  if (disabled) return <span className="ml-auto" />;
  return (
    <button
      onClick={onClear}
      aria-label="Clear conversation"
      className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Eraser className="h-3.5 w-3.5" />
    </button>
  );
}

function ChatEmptyState({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <p>
        Ask about the pull request, a file, or code you have highlighted. I can run
        insight on a selection, dig deeper for a second hop of definitions, read
        files, and look symbols up in the repo index.
      </p>
      <ul className="space-y-1 text-[11px]">
        <li>· “What does the selected code do and what calls it?”</li>
        <li>· “Is this change safe? Dig into the definitions it touches.”</li>
        <li>· “Which files in this PR touch the review store?”</li>
      </ul>
    </div>
  );
}
