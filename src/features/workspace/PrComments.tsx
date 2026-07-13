"use client";

/**
 * PR conversation for the Details tab: inline review threads (clickable to jump
 * to the file/line) and the top-level discussion. Each body renders as markdown.
 */

import { MessageSquare } from "lucide-react";
import { Loader } from "@/components/Loader";
import { Markdown } from "@/components/Markdown";
import { Tooltip } from "@/components/Tooltip";
import { timeAgo } from "@/lib/time";
import { useWorkspaceStore } from "@/features/workspace/store";
import { usePrComments } from "@/hooks/usePrComments";
import type {
  PrComment,
  PrCommentThread,
} from "@/domain/pull-request/models";

function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

interface PrCommentsProps {
  owner: string;
  repo: string;
  number: number;
}

export function PrComments({ owner, repo, number }: PrCommentsProps) {
  const { data, isLoading, isError, error } = usePrComments(owner, repo, number);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground">
        <Loader size="sm" /> Loading comments…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="px-4 py-6 text-xs text-destructive">
        {error?.message ?? "Failed to load comments."}
      </div>
    );
  }

  const threads = data?.threads ?? [];
  const conversation = data?.conversation ?? [];

  if (threads.length === 0 && conversation.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-xs text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> No comments yet
      </div>
    );
  }

  return (
    <div className="space-y-3 px-3 py-2">
      {threads.map((thread) => (
        <ThreadCard key={thread.id} thread={thread} />
      ))}
      {conversation.map((comment) => (
        <div key={comment.id} className="rounded-lg border p-2">
          <CommentItem comment={comment} />
        </div>
      ))}
    </div>
  );
}

function ThreadCard({ thread }: { thread: PrCommentThread }) {
  const selectFile = useWorkspaceStore((s) => s.selectFile);
  const requestRevealLine = useWorkspaceStore((s) => s.requestRevealLine);
  const handleJump = () => {
    selectFile(thread.path);
    if (thread.line) requestRevealLine(thread.path, thread.line, "head");
  };

  return (
    <div className="rounded-lg border">
      <Tooltip content="Jump to this line" className="block">
        <button
          onClick={handleJump}
          className="flex w-full items-center gap-1.5 border-b px-2 py-1 text-left hover:bg-muted/50"
        >
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {basename(thread.path)}
            {thread.line ? `:${thread.line}` : ""}
          </span>
        </button>
      </Tooltip>
      <div className="divide-y">
        {thread.comments.map((comment) => (
          <div key={comment.id} className="p-2">
            <CommentItem comment={comment} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentItem({ comment }: { comment: PrComment }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs">
        <span className="font-medium">{comment.author}</span>
        <span className="text-muted-foreground">{timeAgo(comment.createdAt)}</span>
      </div>
      <Markdown className="text-xs">{comment.body}</Markdown>
    </div>
  );
}
