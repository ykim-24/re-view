"use client";

/**
 * The "verify comment" window shown beside a review thread. It streams an
 * assessment of whether the reviewer's point holds (grounded in the gathered
 * code) as the main container, then surfaces a suggested reply in its own box
 * that can be posted to the thread in one click. A "Logs" container below shows
 * the gather steps and context, mirroring the insight and auto-review panels.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Copy, ShieldQuestion, X } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StreamedAnswer } from "./InsightPanel";
import { StepLogs } from "./StepLogs";
import { useVerifyComment } from "@/hooks/useVerifyComment";
import { useReplyToComment } from "@/hooks/useReplyToComment";
import type { PrComment, PrCommentThread } from "@/domain/pull-request/models";

const PANEL = "flex flex-col overflow-hidden rounded-lg border bg-background shadow-2xl";

const PANEL_WIDTH = 340;
const GAP = 8;
const MARGIN = 8;

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/**
 * Choose the panel's x-offset (relative to the thread popover it anchors to):
 * prefer the right side, fall back to the left, and clamp within the viewport
 * when neither side has room.
 */
function offsetLeftOf(popover: DOMRect): number {
  const vw = window.innerWidth;
  const rightStart = popover.right + GAP;
  const leftStart = popover.left - GAP - PANEL_WIDTH;

  let viewportLeft: number;
  if (rightStart + PANEL_WIDTH <= vw - MARGIN) {
    viewportLeft = rightStart;
  } else if (leftStart >= MARGIN) {
    viewportLeft = leftStart;
  } else if (vw - popover.right >= popover.left) {
    viewportLeft = Math.max(MARGIN, vw - MARGIN - PANEL_WIDTH);
  } else {
    viewportLeft = MARGIN;
  }
  return viewportLeft - popover.left;
}

interface CommentVerifyPanelProps {
  owner: string;
  repo: string;
  number: number;
  headRef: string;
  thread: PrCommentThread;
  comment: PrComment;
  onClose(): void;
}

export function CommentVerifyPanel({
  owner,
  repo,
  number,
  headRef,
  thread,
  comment,
  onClose,
}: CommentVerifyPanelProps) {
  const { steps, files, answer, reply, isStreaming, run } = useVerifyComment();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [offsetLeft, setOffsetLeft] = useState<number | null>(null);

  useEffect(() => {
    run({
      owner,
      repo,
      headRef,
      path: thread.path,
      line: thread.line,
      author: comment.author,
      body: comment.body,
      thread: thread.comments.map((c) => ({ author: c.author, body: c.body })),
    });
  }, [owner, repo, headRef, thread, comment, run]);

  const reposition = useCallback(() => {
    const popover = wrapperRef.current?.offsetParent;
    if (!popover) return;
    setOffsetLeft(offsetLeftOf(popover.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    reposition();
    window.addEventListener("resize", reposition);
    return () => window.removeEventListener("resize", reposition);
  }, [reposition]);

  return (
    <div
      ref={wrapperRef}
      style={{ left: offsetLeft ?? PANEL_WIDTH + GAP }}
      className={cn(
        "absolute top-0 z-40 flex max-h-[70vh] w-[340px] flex-col gap-2",
        isStreaming && "cursor-progress",
      )}
    >
      <div className={cn(PANEL, "min-h-0")}>
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
          <ShieldQuestion className="h-3.5 w-3.5 shrink-0 text-sky-400" />
          <span className="text-xs font-medium">Verify comment</span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {basename(thread.path)}
            {thread.line ? `:${thread.line}` : ""}
          </span>
          <button
            onClick={onClose}
            className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close verify"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[40vh] min-h-[120px] overflow-y-auto p-3">
          <StreamedAnswer answer={answer} isStreaming={isStreaming} />
        </div>
        <SuggestedReply
          owner={owner}
          repo={repo}
          number={number}
          rootId={thread.id}
          reply={reply}
          isStreaming={isStreaming}
          onPosted={onClose}
        />
      </div>

      <StepLogs steps={steps} files={files} isStreaming={isStreaming} />
    </div>
  );
}

interface SuggestedReplyProps {
  owner: string;
  repo: string;
  number: number;
  rootId: number;
  reply: string;
  isStreaming: boolean;
  onPosted(): void;
}

function SuggestedReply({
  owner,
  repo,
  number,
  rootId,
  reply,
  isStreaming,
  onPosted,
}: SuggestedReplyProps) {
  const post = useReplyToComment(owner, repo, number);
  const [copied, setCopied] = useState(false);

  if (!reply) return null;

  const trimmed = reply.trim();
  const settled = !isStreaming;

  const handleReply = () => {
    if (!trimmed || post.isPending) return;
    post.mutate(
      { commentId: rootId, body: trimmed },
      {
        onSuccess: () => {
          toast.success("Reply posted");
          onPosted();
        },
        onError: (err) => {
          toast.error(err.message || "Couldn't post reply");
        },
      },
    );
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(trimmed).then(() => {
      setCopied(true);
      toast.success("Reply copied");
    });
  };

  return (
    <div className="shrink-0 border-t">
      <div className="flex items-center gap-1.5 px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Suggested reply
      </div>
      <div className="max-h-[22vh] overflow-y-auto px-3 pb-2 pt-1">
        <Markdown className="text-xs" allowHtml={false}>{reply}</Markdown>
      </div>
      <div className="flex items-center gap-1.5 border-t px-3 py-1.5">
        <Button
          size="sm"
          onClick={handleReply}
          disabled={!settled || !trimmed || post.isPending}
        >
          Reply with this
        </Button>
        <button
          onClick={handleCopy}
          disabled={!settled || !trimmed}
          className="flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <CopyIcon copied={copied} />
          Copy
        </button>
      </div>
    </div>
  );
}

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) return <Check className="h-3 w-3 text-emerald-400" />;
  return <Copy className="h-3 w-3" />;
}
