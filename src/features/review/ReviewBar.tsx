"use client";

/**
 * Bottom review bar: an overall summary, the review action, submit, and a
 * right-side comments dropdown that opens upward (window-aware) listing the
 * staged inline comments.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { gsap } from "gsap";
import { toast } from "sonner";
import {
  Check,
  MessageSquare,
  XCircle,
  Send,
  Trash2,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/Tooltip";
import { useReviewStore } from "./store";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useSubmitReview } from "@/hooks/useSubmitReview";
import { useQueueActions } from "@/hooks/useQueue";
import type {
  DashboardPr,
  InlineCommentDraft,
  ReviewEvent,
} from "@/domain/pull-request/models";
import type { SubmitReviewResult } from "@/hooks/useSubmitReview";

interface EventOption {
  value: ReviewEvent;
  label: string;
  icon: LucideIcon;
}

const EVENTS: EventOption[] = [
  { value: "COMMENT", label: "Comment", icon: MessageSquare },
  { value: "APPROVE", label: "Approve", icon: Check },
  { value: "REQUEST_CHANGES", label: "Request changes", icon: XCircle },
];

function badgeVariant(count: number): "default" | "secondary" {
  if (count > 0) return "default";
  return "secondary";
}

function submitLabel(pending: boolean): string {
  if (pending) return "Submitting…";
  return "Submit";
}

function fileLabel(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

interface ReviewBarProps {
  owner: string;
  repo: string;
  number: number;
  prSnapshot: DashboardPr;
}

export function ReviewBar({ owner, repo, number, prSnapshot }: ReviewBarProps) {
  const drafts = useReviewStore((s) => s.drafts);
  const removeDraft = useReviewStore((s) => s.removeDraft);
  const body = useReviewStore((s) => s.body);
  const setBody = useReviewStore((s) => s.setBody);
  const event = useReviewStore((s) => s.event);
  const setEvent = useReviewStore((s) => s.setEvent);
  const clearStaged = useReviewStore((s) => s.clearStaged);
  const { markFinished } = useQueueActions();
  const submit = useSubmitReview(owner, repo, number);

  const handleBodyChange = (e: ChangeEvent<HTMLTextAreaElement>) =>
    setBody(e.target.value);

  const handleSubmitSuccess = (res: SubmitReviewResult) => {
    const openOnGitHub = () => window.open(res.url, "_blank");
    toast.success("Review submitted", {
      action: { label: "View on GitHub", onClick: openOnGitHub },
    });
    markFinished(prSnapshot);
    clearStaged();
  };

  const handleSubmitError = (err: Error) => {
    const offDiff = /line could not be resolved/i.test(err.message);
    toast.error(
      offDiff
        ? "A comment is on a line GitHub doesn't have in the diff. Remove or move it, then submit again."
        : err.message,
      { description: offDiff ? err.message : undefined },
    );
  };

  const handleSubmit = () => {
    submit.mutate(
      { owner, repo, number, event, body, comments: drafts },
      { onSuccess: handleSubmitSuccess, onError: handleSubmitError },
    );
  };

  const submitDisabled =
    submit.isPending || (event === "REQUEST_CHANGES" && !body.trim());

  return (
    <div className="flex items-center gap-2 border-t bg-background px-3 py-2">
      <Textarea
        value={body}
        onChange={handleBodyChange}
        placeholder="Overall review summary (optional)…"
        className="h-9 min-h-9 flex-1 resize-none py-1.5"
      />

      <div className="flex shrink-0 overflow-hidden rounded-md border">
        {EVENTS.map((option) => (
          <EventButton
            key={option.value}
            option={option}
            active={event === option.value}
            onSelect={setEvent}
          />
        ))}
      </div>

      <Button size="sm" onClick={handleSubmit} disabled={submitDisabled}>
        <Send className="mr-1 h-3.5 w-3.5" />
        {submitLabel(submit.isPending)}
      </Button>

      <CommentsDropdown drafts={drafts} onRemove={removeDraft} />
    </div>
  );
}

interface CommentsDropdownProps {
  drafts: InlineCommentDraft[];
  onRemove(index: number): void;
}

function CommentsDropdown({ drafts, onRemove }: CommentsDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    if (drafts.length === 0) return;
    setOpen((v) => !v);
  };
  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        disabled={drafts.length === 0}
        className="flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
      >
        <Badge variant={badgeVariant(drafts.length)}>{drafts.length}</Badge>
        Comments
        <ChevronUp
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <CommentsPanel
          drafts={drafts}
          triggerRef={triggerRef}
          onRemove={onRemove}
          onClose={close}
        />
      )}
    </>
  );
}

interface CommentsPanelProps {
  drafts: InlineCommentDraft[];
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onRemove(index: number): void;
  onClose(): void;
}

interface PanelPos {
  bottom: number;
  right: number;
}

function CommentsPanel({
  drafts,
  triggerRef,
  onRemove,
  onClose,
}: CommentsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const animated = useRef(false);
  const selectFile = useWorkspaceStore((s) => s.selectFile);
  const requestRevealLine = useWorkspaceStore((s) => s.requestRevealLine);

  const handleJump = (draft: InlineCommentDraft) => {
    selectFile(draft.path);
    requestRevealLine(draft.path, draft.line, draft.side === "LEFT" ? "base" : "head");
    onClose();
  };

  useLayoutEffect(() => {
    if (!pos || animated.current || !panelRef.current) return;
    animated.current = true;
    gsap.fromTo(
      panelRef.current,
      { y: 10, opacity: 0, scale: 0.97 },
      {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: 0.2,
        ease: "power3.out",
        transformOrigin: "bottom right",
        clearProps: "transform,opacity",
      },
    );
  }, [pos]);

  useEffect(() => {
    const el = triggerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      // Anchor above the trigger, right edges aligned (so it stays on-screen).
      setPos({
        bottom: window.innerHeight - r.top + 16,
        right: Math.max(12, window.innerWidth - r.right),
      });
    }

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [triggerRef, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        bottom: pos?.bottom ?? -9999,
        right: pos?.right ?? 12,
        zIndex: 9999,
      }}
      className="flex max-h-[60vh] w-[440px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-lg border bg-popover shadow-2xl"
    >
      <div className="shrink-0 border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Staged comments ({drafts.length})
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {drafts.map((draft, i) => (
          <DraftRow
            key={`${draft.path}:${draft.line}:${i}`}
            draft={draft}
            index={i}
            onRemove={onRemove}
            onJump={handleJump}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}

interface DraftRowProps {
  draft: InlineCommentDraft;
  index: number;
  onRemove(index: number): void;
  onJump(draft: InlineCommentDraft): void;
}

function DraftRow({ draft, index, onRemove, onJump }: DraftRowProps) {
  const handleRemove = () => onRemove(index);
  const handleJump = () => onJump(draft);
  return (
    <div className="border-b px-3 py-2 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <Tooltip content="Jump to this line">
          <button
            onClick={handleJump}
            className="truncate font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {fileLabel(draft.path)}:{draft.line}
          </button>
        </Tooltip>
        <button
          onClick={handleRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Remove comment"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-1 whitespace-pre-wrap break-words text-sm">
        {draft.body}
      </div>
    </div>
  );
}

interface EventButtonProps {
  option: EventOption;
  active: boolean;
  onSelect(event: ReviewEvent): void;
}

function EventButton({ option, active, onSelect }: EventButtonProps) {
  const Icon = option.icon;
  const handleClick = () => onSelect(option.value);
  return (
    <Tooltip content={option.label}>
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1.5 text-xs",
          active && "bg-primary text-primary-foreground",
          !active && "hover:bg-muted",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  );
}
