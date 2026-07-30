"use client";

/**
 * The question box: staged context chips, the live "you have code highlighted"
 * hint, and the textarea. Enter sends, Shift+Enter is a newline; while an answer
 * is streaming the send button becomes Stop.
 */

import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { ArrowUp, Square, TextSelect } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useChatStore } from "./chat.store";
import { ChatAttachmentChip } from "./ChatAttachmentChip";
import {
  attachmentLabel,
  sameAttachment,
  type ChatAttachment,
} from "@/domain/chat/models";

interface ChatComposerProps {
  liveSelection: ChatAttachment | null;
  onSend(question: string): void;
  onStop(): void;
}

export function ChatComposer({
  liveSelection,
  onSend,
  onStop,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const staged = useChatStore((s) => s.staged);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const detach = useChatStore((s) => s.detach);
  const attach = useChatStore((s) => s.attach);

  const submit = useCallback(() => {
    const question = value.trim();
    if (!question || isStreaming) return;
    setValue("");
    onSend(question);
  }, [value, isStreaming, onSend]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) =>
    setValue(event.target.value);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const handleAttachSelection = () => {
    if (!liveSelection) return;
    attach(liveSelection);
    inputRef.current?.focus();
  };

  const selectionStaged =
    liveSelection !== null &&
    staged.some((attachment) => sameAttachment(attachment, liveSelection));

  return (
    <div className="shrink-0 space-y-1.5 border-t p-2">
      {staged.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {staged.map((attachment) => (
            <ChatAttachmentChip
              key={attachment.id}
              attachment={attachment}
              onRemove={detach}
            />
          ))}
        </div>
      )}

      <SelectionHint
        selection={liveSelection}
        staged={selectionStaged}
        onAttach={handleAttachSelection}
      />

      <div className="flex items-end gap-1.5">
        <Textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Ask about this PR, a file, or your selection…"
          className="max-h-32 min-h-0 resize-none py-1.5 text-xs"
        />
        <SendButton
          isStreaming={isStreaming}
          disabled={value.trim().length === 0}
          onSend={submit}
          onStop={onStop}
        />
      </div>
    </div>
  );
}

interface SelectionHintProps {
  selection: ChatAttachment | null;
  staged: boolean;
  onAttach(): void;
}

function SelectionHint({ selection, staged, onAttach }: SelectionHintProps) {
  if (!selection || staged) return null;
  return (
    <button
      onClick={onAttach}
      className="flex w-full items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/5 px-1.5 py-1 text-left text-[10px] text-red-200 hover:border-red-500/70"
    >
      <TextSelect className="h-3 w-3 shrink-0" />
      <span className="truncate font-mono">{attachmentLabel(selection)}</span>
      <span className="ml-auto shrink-0 text-red-300/80">highlighted · attach</span>
    </button>
  );
}

interface SendButtonProps {
  isStreaming: boolean;
  disabled: boolean;
  onSend(): void;
  onStop(): void;
}

function SendButton({ isStreaming, disabled, onSend, onStop }: SendButtonProps) {
  if (isStreaming) {
    return (
      <button
        onClick={onStop}
        aria-label="Stop generating"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-gradient-to-b from-neutral-700 to-neutral-950 text-neutral-200 hover:border-red-500/70"
      >
        <Square className="h-3 w-3" />
      </button>
    );
  }
  return (
    <button
      onClick={onSend}
      disabled={disabled}
      aria-label="Send question"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-neutral-700 bg-gradient-to-b from-neutral-700 to-neutral-950 text-neutral-200 transition-colors",
        !disabled && "hover:border-red-500/70 hover:text-red-300",
        disabled && "opacity-40",
      )}
    >
      <ArrowUp className="h-3.5 w-3.5" />
    </button>
  );
}
