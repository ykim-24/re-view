"use client";

/**
 * One attached piece of context — a highlighted range or a whole file — rendered
 * as a removable chip. Used both for what is staged for the next question and for
 * what a sent question carried (where it is not removable).
 */

import { FileCode, TextSelect, X } from "lucide-react";
import { attachmentLabel, type ChatAttachment } from "@/domain/chat/models";
import { cn } from "@/lib/utils";

interface ChatAttachmentChipProps {
  attachment: ChatAttachment;
  onRemove?(id: string): void;
}

export function ChatAttachmentChip({
  attachment,
  onRemove,
}: ChatAttachmentChipProps) {
  const handleRemove = () => onRemove?.(attachment.id);

  return (
    <span
      className={cn(
        "flex max-w-full items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground",
        onRemove && "pr-1",
      )}
    >
      <ChipIcon kind={attachment.kind} />
      <span className="truncate">{attachmentLabel(attachment)}</span>
      {onRemove && (
        <button
          onClick={handleRemove}
          aria-label={`Remove ${attachmentLabel(attachment)}`}
          className="rounded p-0.5 hover:bg-muted hover:text-foreground"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}

function ChipIcon({ kind }: { kind: ChatAttachment["kind"] }) {
  if (kind === "file") return <FileCode className="h-2.5 w-2.5 shrink-0" />;
  return <TextSelect className="h-2.5 w-2.5 shrink-0 text-red-400" />;
}
