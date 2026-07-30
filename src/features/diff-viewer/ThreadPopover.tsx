"use client";

/** Our own styled review-thread card, shown when a gutter comment bubble is clicked. */

import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { ShieldQuestion, X } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/time";
import { useReplyToComment } from "@/hooks/useReplyToComment";
import { CommentVerifyPanel } from "./CommentVerifyPanel";
import type { PrComment, PrCommentThread } from "@/domain/pull-request/models";

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function commentCountLabel(count: number): string {
  if (count === 1) return "1 comment";
  return `${count} comments`;
}

interface ThreadPopoverProps {
  thread: PrCommentThread;
  owner: string;
  repo: string;
  number: number;
  headRef: string;
  top: number;
  left: number;
  onClose(): void;
}

export function ThreadPopover({
  thread,
  owner,
  repo,
  number,
  headRef,
  top,
  left,
  onClose,
}: ThreadPopoverProps) {
  const [verifyingId, setVerifyingId] = useState<number | null>(null);

  const handleVerify = (commentId: number) =>
    setVerifyingId((current) => (current === commentId ? null : commentId));

  const handleCloseVerify = () => setVerifyingId(null);

  const verifying = thread.comments.find((c) => c.id === verifyingId) ?? null;

  return (
    <div style={{ top: top + 22, left }} className="absolute z-30 w-[420px] max-w-[80%]">
      {verifying && (
        <CommentVerifyPanel
          owner={owner}
          repo={repo}
          number={number}
          headRef={headRef}
          thread={thread}
          comment={verifying}
          onClose={handleCloseVerify}
        />
      )}

      <div className="flex max-h-[60vh] flex-col overflow-hidden rounded-lg border bg-background shadow-2xl">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {basename(thread.path)}
          {thread.line ? `:${thread.line}` : ""}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {commentCountLabel(thread.comments.length)}
        </span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close thread"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 divide-y overflow-y-auto">
        {thread.comments.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            active={comment.id === verifyingId}
            onVerify={handleVerify}
          />
        ))}
      </div>

      <ReplyComposer
        owner={owner}
        repo={repo}
        number={number}
        commentId={thread.id}
      />
      </div>
    </div>
  );
}

interface CommentRowProps {
  comment: PrComment;
  active: boolean;
  onVerify(commentId: number): void;
}

function CommentRow({ comment, active, onVerify }: CommentRowProps) {
  const handleVerify = () => onVerify(comment.id);

  return (
    <div className="p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs">
        <span className="font-medium">{comment.author}</span>
        <span className="text-muted-foreground">{timeAgo(comment.createdAt)}</span>
        <button
          onClick={handleVerify}
          aria-label="Verify this comment"
          className={cn(
            "ml-auto flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-sky-500/60 hover:text-sky-300",
            active && "border-sky-500/60 text-sky-300",
          )}
        >
          <ShieldQuestion className="h-3 w-3" />
          Verify
        </button>
      </div>
      <Markdown className="text-xs">{comment.body}</Markdown>
    </div>
  );
}

interface ReplyComposerProps {
  owner: string;
  repo: string;
  number: number;
  commentId: number;
}

function ReplyComposer({ owner, repo, number, commentId }: ReplyComposerProps) {
  const reply = useReplyToComment(owner, repo, number);
  const [body, setBody] = useState("");

  const submit = () => {
    const trimmed = body.trim();
    if (!trimmed || reply.isPending) return;
    reply.mutate(
      { commentId, body: trimmed },
      {
        onSuccess: () => {
          setBody("");
          toast.success("Reply posted");
        },
        onError: (err) => {
          toast.error(err.message || "Couldn't post reply");
        },
      },
    );
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) =>
    setBody(e.target.value);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
  };

  return (
    <div className="shrink-0 border-t p-2">
      <Textarea
        value={body}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Reply… (⌘↵ to send, markdown supported)"
        className="min-h-[56px] resize-none text-xs"
      />
      <div className="mt-1.5 flex justify-end">
        <Button
          size="sm"
          onClick={submit}
          disabled={!body.trim() || reply.isPending}
        >
          Reply
        </Button>
      </div>
    </div>
  );
}
