"use client";

/**
 * Inline composer for the definition drawer: stages a review comment anchored to
 * the definition's file/line. Staged into the review store (via addDraftDirect)
 * so it submits with the rest of the review, exactly like a diff comment.
 */

import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useReviewStore } from "@/features/review/store";
import type { InlineCommentDraft } from "@/domain/pull-request/models";

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function lineLabel(line: number, endLine: number): string {
  if (line === endLine) return `${line}`;
  return `${line}–${endLine}`;
}

interface DrawerCommentBoxProps {
  path: string;
  line: number;
  endLine: number;
  onClose(): void;
}

export function DrawerCommentBox({
  path,
  line,
  endLine,
  onClose,
}: DrawerCommentBoxProps) {
  const addDraftDirect = useReviewStore((s) => s.addDraftDirect);
  const [body, setBody] = useState("");

  const submit = () => {
    if (!body.trim()) return;
    const draft: InlineCommentDraft = {
      path,
      line: endLine,
      side: "RIGHT",
      body: body.trim(),
    };
    if (line !== endLine) draft.startLine = line;
    addDraftDirect(draft);
    setBody("");
    onClose();
    toast.success(`Comment staged on ${basename(path)}:${lineLabel(line, endLine)}`);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) =>
    setBody(e.target.value);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="shrink-0 border-t p-3">
      <div className="mb-2 truncate text-xs text-muted-foreground">
        Comment on{" "}
        <span className="font-medium text-foreground">
          {basename(path)}:{lineLabel(line, endLine)}
        </span>
      </div>
      <Textarea
        autoFocus
        value={body}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Leave a comment… (⌘↵ to stage)"
        className="min-h-[72px] resize-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={!body.trim()}>
          Add comment
        </Button>
      </div>
    </div>
  );
}
