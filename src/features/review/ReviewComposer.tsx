"use client";

/**
 * Floating inline-comment composer, positioned next to the line being commented
 * on. Staged into the review store on add (not sent until the review is
 * submitted). Shows a snippet of any highlighted text for context.
 */

import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useReviewStore } from "./store";

interface ReviewComposerProps {
  top: number;
  left: number;
}

export function ReviewComposer({ top, left }: ReviewComposerProps) {
  const pending = useReviewStore((s) => s.pending);
  if (!pending) return null;
  return (
    <Composer
      key={`${pending.path}:${pending.startLine}:${pending.endLine}`}
      path={pending.path}
      startLine={pending.startLine}
      endLine={pending.endLine}
      selectedText={pending.selectedText}
      top={top}
      left={left}
    />
  );
}

function lineRangeLabel(startLine: number, endLine: number): string {
  if (startLine === endLine) return `${startLine}`;
  return `${startLine}–${endLine}`;
}

interface ComposerProps {
  path: string;
  startLine: number;
  endLine: number;
  selectedText: string;
  top: number;
  left: number;
}

function Composer({
  path,
  startLine,
  endLine,
  selectedText,
  top,
  left,
}: ComposerProps) {
  const addDraft = useReviewStore((s) => s.addDraft);
  const cancel = useReviewStore((s) => s.cancelComment);
  const [body, setBody] = useState("");

  const submit = () => addDraft(body);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) =>
    setBody(e.target.value);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
    if (e.key === "Escape") cancel();
  };

  return (
    <div
      style={{ top: top + 24, left }}
      className="absolute z-30 w-[440px] max-w-[80%] rounded-lg border bg-background p-3 shadow-2xl"
    >
      <div className="mb-2 truncate text-xs text-muted-foreground">
        Comment on{" "}
        <span className="font-medium text-foreground">
          {path.slice(path.lastIndexOf("/") + 1)}:
          {lineRangeLabel(startLine, endLine)}
        </span>
      </div>
      {selectedText.trim() && <SelectedSnippet text={selectedText} />}
      <Textarea
        autoFocus
        value={body}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Leave a comment… (⌘↵ to add)"
        className="min-h-[80px] resize-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={cancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={!body.trim()}>
          Add comment
        </Button>
      </div>
    </div>
  );
}

function SelectedSnippet({ text }: { text: string }) {
  return (
    <pre className="mb-2 max-h-20 overflow-auto rounded border bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
      {text}
    </pre>
  );
}
