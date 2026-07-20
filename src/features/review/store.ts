import { create } from "zustand";
import type {
  InlineCommentDraft,
  ReviewDraftState,
  ReviewEvent,
} from "@/domain/pull-request/models";

interface PendingComment {
  path: string;
  startLine: number;
  endLine: number;
  selectedText: string;
}

interface ReviewState {
  /** lines just selected to comment on, awaiting a body */
  pending: PendingComment | null;
  drafts: InlineCommentDraft[];
  body: string;
  event: ReviewEvent;
  /** files the reviewer has personally marked as viewed / good to go (local) */
  viewedFiles: Set<string>;

  startComment(
    path: string,
    startLine: number,
    endLine: number,
    selectedText: string,
  ): void;
  cancelComment(): void;
  addDraft(body: string): void;
  /** stage a fully-formed comment without going through the line-selection flow */
  addDraftDirect(draft: InlineCommentDraft): void;
  removeDraft(index: number): void;
  setBody(body: string): void;
  setEvent(event: ReviewEvent): void;
  toggleViewed(path: string): void;
  /** idempotently mark a file viewed (used by the keyboard shortcut) */
  markViewed(path: string): void;
  /** replace the whole review state from persistence when a PR loads */
  hydrate(state: ReviewDraftState): void;
  /** clears staged comments/summary after a review is submitted; keeps viewed */
  clearStaged(): void;
  /** full reset when switching PRs */
  reset(): void;
}

export const useReviewStore = create<ReviewState>((set) => ({
  pending: null,
  drafts: [],
  body: "",
  event: "COMMENT",
  viewedFiles: new Set<string>(),

  startComment: (path, startLine, endLine, selectedText) =>
    set({ pending: { path, startLine, endLine, selectedText } }),
  cancelComment: () => set({ pending: null }),
  addDraft: (body) =>
    set((s) => {
      if (!s.pending || !body.trim()) return { pending: null };
      const { path, startLine, endLine, selectedText } = s.pending;
      const draft: InlineCommentDraft = {
        path,
        line: endLine,
        side: "RIGHT",
        body: body.trim(),
      };
      if (startLine !== endLine) draft.startLine = startLine;
      if (selectedText) draft.selectedText = selectedText;
      return { drafts: [...s.drafts, draft], pending: null };
    }),
  addDraftDirect: (draft) =>
    set((s) => {
      if (!draft.body.trim()) return s;
      return { drafts: [...s.drafts, draft] };
    }),
  removeDraft: (index) =>
    set((s) => ({ drafts: s.drafts.filter((_, i) => i !== index) })),
  setBody: (body) => set({ body }),
  setEvent: (event) => set({ event }),
  toggleViewed: (path) =>
    set((s) => {
      const next = new Set(s.viewedFiles);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { viewedFiles: next };
    }),
  markViewed: (path) =>
    set((s) => {
      if (s.viewedFiles.has(path)) return s;
      const next = new Set(s.viewedFiles);
      next.add(path);
      return { viewedFiles: next };
    }),
  hydrate: (state) =>
    set({
      drafts: state.drafts,
      body: state.body,
      event: state.event,
      viewedFiles: new Set(state.viewed),
      pending: null,
    }),
  clearStaged: () => set({ drafts: [], body: "", event: "COMMENT", pending: null }),
  reset: () =>
    set({
      drafts: [],
      body: "",
      event: "COMMENT",
      pending: null,
      viewedFiles: new Set<string>(),
    }),
}));
