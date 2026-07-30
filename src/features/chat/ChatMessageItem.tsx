"use client";

/**
 * One turn in the transcript. The user's turn is a right-aligned bubble carrying
 * the chips for whatever it had attached; the assistant's is full-width markdown
 * preceded by its tool trace, standing in a "slithering" status line until the
 * first token lands. Citations in the answer open the file in the diff viewer's
 * drawer.
 */

import { Markdown } from "@/components/Markdown";
import { useWorkspaceStore } from "@/features/workspace/store";
import { cn } from "@/lib/utils";
import { ChatAttachmentChip } from "./ChatAttachmentChip";
import { ChatToolTrace } from "./ChatToolTrace";
import { ChatThinking } from "./ChatThinking";
import type { ChatMessage } from "@/domain/chat/models";

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming: boolean;
}

export function ChatMessageItem({ message, isStreaming }: ChatMessageItemProps) {
  if (message.role === "user") return <UserTurn message={message} />;
  return <AssistantTurn message={message} isStreaming={isStreaming} />;
}

function UserTurn({ message }: { message: ChatMessage }) {
  const { text, attachments } = message;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-muted px-2.5 py-1.5 text-xs text-foreground">
        {text}
      </div>
      {attachments.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1">
          {attachments.map((attachment) => (
            <ChatAttachmentChip key={attachment.id} attachment={attachment} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantTurn({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  const openPeek = useWorkspaceStore((s) => s.openPeek);
  const { text, tools, failed } = message;

  const handleSourceClick = (path: string, line?: number) => {
    openPeek(path, line);
  };

  return (
    <div className="flex flex-col">
      <ChatToolTrace tools={tools} />
      <AnswerBody
        text={text}
        isStreaming={isStreaming}
        failed={failed}
        onSourceClick={handleSourceClick}
      />
    </div>
  );
}

interface AnswerBodyProps {
  text: string;
  isStreaming: boolean;
  failed?: boolean;
  onSourceClick(path: string, line?: number): void;
}

function AnswerBody({ text, isStreaming, failed, onSourceClick }: AnswerBodyProps) {
  if (!text && isStreaming) return <ChatThinking />;
  return (
    <Markdown
      className={cn("text-xs", failed && "text-red-300")}
      allowHtml={false}
      onSourceClick={onSourceClick}
    >
      {text}
    </Markdown>
  );
}
