"use client";

/**
 * Center pane. Modified files render as a full-file Monaco diff (base vs head);
 * brand-new files render as a plain file view with a green gutter bar. Cmd/Ctrl
 * +click a symbol to go to its definition; select lines (or click the gutter) to
 * stage an inline comment; the tree can request a scroll to a symbol or line.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { useFileContent } from "@/hooks/useFileContent";
import { useResolveSymbol } from "@/hooks/useResolveSymbol";
import { usePrComments } from "@/hooks/usePrComments";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useReviewStore } from "@/features/review/store";
import { languageForPath, isCodeIntelPath } from "@/lib/language";
import { disableBuiltInCodeNav } from "@/lib/monaco";
import {
  applyTypeContext,
  rehomeModifiedModel,
  type TypeContext,
} from "@/lib/monaco-types";
import { api } from "@/lib/apiClient";
import { commentableHeadLines } from "@/domain/pull-request/changes";
import { ReviewComposer } from "@/features/review/ReviewComposer";
import { ThreadPopover } from "./ThreadPopover";
import { SelectionRadialMenu } from "./SelectionRadialMenu";
import { useSelectionMenu } from "./selection-menu.store";
import { useInsightStore } from "./insight.store";
import { InsightPanel } from "./InsightPanel";
import { useInsight } from "@/hooks/useInsight";
import { useInsightFeedback } from "@/hooks/useInsightFeedback";
import type { FileChange, PrCommentThread } from "@/domain/pull-request/models";
import { Loader } from "@/components/Loader";

const editorLoading = () => (
  <div className="flex h-full w-full items-center justify-center">
    <Loader />
  </div>
);

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.DiffEditor),
  { ssr: false, loading: editorLoading },
);

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  { ssr: false, loading: editorLoading },
);

const EDITOR_OPTIONS = {
  readOnly: true,
  automaticLayout: true,
  glyphMargin: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
  lineHeight: 20,
  fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
  renderWhitespace: "none" as const,
  renderOverviewRuler: false,
  lineDecorationsWidth: 16,
};

interface Point {
  top: number;
  left: number;
}


/**
 * Convert an editor line/column to coordinates relative to the diff container.
 * In split mode the modified editor is the right pane, so its own coordinates
 * must be offset by where its DOM node sits inside the container.
 */
function toContainerPoint(
  ed: editor.IStandaloneCodeEditor,
  container: HTMLElement,
  lineNumber: number,
  column: number,
): Point | null {
  const pos = ed.getScrolledVisiblePosition({ lineNumber, column });
  const node = ed.getDomNode();
  if (!pos || !node) return null;
  const er = node.getBoundingClientRect();
  const cr = container.getBoundingClientRect();
  const top = er.top - cr.top + pos.top;
  const left = er.left - cr.left + pos.left;
  if (!Number.isFinite(top) || !Number.isFinite(left)) return null;
  return { top, left };
}

interface DiffViewerProps {
  owner: string;
  repo: string;
  /** the PR number when reviewing a PR; omitted for a bare branch comparison */
  number?: number;
  baseRef: string;
  headRef: string;
  file: FileChange;
}

export function DiffViewer({
  owner,
  repo,
  number,
  baseRef,
  headRef,
  file,
}: DiffViewerProps) {
  const canReview = number !== undefined;
  const diffMode = useWorkspaceStore((s) => s.diffMode);
  const openDefinition = useWorkspaceStore((s) => s.openDefinition);
  const setDefinitionResult = useWorkspaceStore((s) => s.setDefinitionResult);
  const setDefinitionError = useWorkspaceStore((s) => s.setDefinitionError);
  const reveal = useWorkspaceStore((s) => s.reveal);
  const startComment = useReviewStore((s) => s.startComment);
  const drafts = useReviewStore((s) => s.drafts);
  const pending = useReviewStore((s) => s.pending);
  const resolve = useResolveSymbol();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const originalRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const commentsDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const lastRevealNonce = useRef(0);
  const [mounted, setMounted] = useState(false);
  const menuAnchor = useSelectionMenu((s) => s.anchor);
  const closeMenu = useSelectionMenu((s) => s.close);
  const [composerPos, setComposerPos] = useState<Point | null>(null);
  const insightReq = useInsightStore((s) => s.request);
  const openInsight = useInsightStore((s) => s.open);
  const closeInsightStore = useInsightStore((s) => s.close);
  const {
    steps: insightSteps,
    files: insightFiles,
    answer: insightAnswer,
    isStreaming: insightStreaming,
    run: runInsight,
    reset: resetInsight,
  } = useInsight();
  const feedback = useInsightFeedback();
  const triggerInsightRef = useRef<() => void>(() => {});

  const comments = usePrComments(owner, repo, number);
  const fileThreads = useMemo(
    () => (comments.data?.threads ?? []).filter((t) => t.path === file.path),
    [comments.data, file.path],
  );
  const fileThreadsRef = useRef(fileThreads);
  useEffect(() => {
    fileThreadsRef.current = fileThreads;
  }, [fileThreads]);
  const [openThread, setOpenThread] = useState<{
    thread: PrCommentThread;
    top: number;
    left: number;
  } | null>(null);

  const isNew = file.status === "added";
  const base = useFileContent(owner, repo, file.path, baseRef, !isNew);
  const head = useFileContent(owner, repo, file.path, headRef, file.status !== "removed");

  const canIntel = isCodeIntelPath(file.path);

  const commentable = useMemo(
    () => commentableHeadLines(file.patch),
    [file.patch],
  );

  const ensureCommentable = useCallback(
    (startLine: number, endLine: number): boolean => {
      if (commentable.size === 0) return true;
      for (let line = startLine; line <= endLine; line++) {
        if (!commentable.has(line)) {
          toast.error("GitHub only lets you comment on lines shown in the diff.");
          return false;
        }
      }
      return true;
    },
    [commentable],
  );

  const attach = useCallback(
    (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      disableBuiltInCodeNav(monaco);
      editorRef.current = ed;
      decorationsRef.current = ed.createDecorationsCollection();
      commentsDecorationsRef.current = ed.createDecorationsCollection();

      const updateAnchor = () => {
        const sel = ed.getSelection();
        const container = containerRef.current;
        if (!sel || sel.isEmpty() || !container) {
          useSelectionMenu.getState().close();
          return;
        }
        const point = toContainerPoint(
          ed,
          container,
          sel.endLineNumber,
          sel.endColumn,
        );
        const { height } = ed.getLayoutInfo();
        const cw = container.clientWidth;
        if (!point || point.top < 0 || point.top > height) {
          useSelectionMenu.getState().close();
          return;
        }
        useSelectionMenu.getState().open({
          path: file.path,
          startLine: sel.startLineNumber,
          endLine: sel.endLineNumber,
          top: point.top,
          left: Math.min(point.left + 10, cw - 170),
          selectedText: ed.getModel()?.getValueInRange(sel) ?? "",
        });
      };

      ed.onDidChangeCursorSelection(updateAnchor);
      ed.onDidScrollChange(updateAnchor);
      ed.onDidScrollChange(() => setOpenThread(null));

      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
        if (!canReview) return;
        const model = ed.getModel();
        const sel = ed.getSelection();
        if (!model || !sel) return;
        useSelectionMenu.getState().close();
        if (sel.isEmpty()) {
          const ln = ed.getPosition()?.lineNumber ?? sel.startLineNumber;
          if (ensureCommentable(ln, ln)) startComment(file.path, ln, ln, "");
          return;
        }
        if (!ensureCommentable(sel.startLineNumber, sel.endLineNumber)) return;
        startComment(
          file.path,
          sel.startLineNumber,
          sel.endLineNumber,
          model.getValueInRange(sel),
        );
      });

      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
        triggerInsightRef.current();
      });

      ed.onMouseDown((e) => {
        const pos = e.target.position;
        if (!pos) return;
        const isCmd = e.event.metaKey || e.event.ctrlKey;

        if (isCmd && canIntel) {
          const word = ed.getModel()?.getWordAtPosition(pos);
          if (!word) return;
          openDefinition(word.word);
          resolve.mutate(
            { owner, repo, ref: headRef, importerPath: file.path, symbol: word.word },
            {
              onSuccess: (res) => setDefinitionResult(res),
              onError: (err) => setDefinitionError(err.message),
            },
          );
          return;
        }

        if (
          canReview &&
          e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
        ) {
          const container = containerRef.current;
          const thread = fileThreadsRef.current.find(
            (t) => t.line === pos.lineNumber,
          );
          if (thread && container) {
            const point = toContainerPoint(ed, container, pos.lineNumber, 1);
            if (point) {
              setOpenThread({
                thread,
                top: point.top,
                left: Math.min(point.left + 12, container.clientWidth - 440),
              });
              return;
            }
          }
          if (ensureCommentable(pos.lineNumber, pos.lineNumber)) {
            startComment(file.path, pos.lineNumber, pos.lineNumber, "");
          }
        }
      });

      setMounted(true);
    },
    [
      canIntel,
      canReview,
      owner,
      repo,
      headRef,
      file.path,
      resolve,
      openDefinition,
      setDefinitionResult,
      setDefinitionError,
      startComment,
      ensureCommentable,
    ],
  );

  const handleDiffMount = useCallback(
    (diffEditor: editor.IStandaloneDiffEditor, monaco: Monaco) => {
      originalRef.current = diffEditor.getOriginalEditor();
      attach(diffEditor.getModifiedEditor(), monaco);

      if (canIntel) {
        rehomeModifiedModel(monaco, diffEditor, file.path, languageForPath(file.path));
        api
          .post<TypeContext>("/api/type-context", {
            owner,
            repo,
            ref: headRef,
            path: file.path,
          })
          .then((ctx) => applyTypeContext(monaco, ctx))
          .catch(() => undefined);
      }
    },
    [attach, canIntel, owner, repo, headRef, file.path],
  );

  const handleNewFileMount = useCallback(
    (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      attach(ed, monaco);
      const count = ed.getModel()?.getLineCount() ?? 0;
      const all = [];
      for (let i = 1; i <= count; i++) {
        all.push({
          range: { startLineNumber: i, startColumn: 1, endLineNumber: i, endColumn: 1 },
          options: { isWholeLine: true, linesDecorationsClassName: "rev-added-gutter" },
        });
      }
      ed.createDecorationsCollection(all);
    },
    [attach],
  );

  const handleCloseThread = () => setOpenThread(null);

  const handleCommentClick = () => {
    if (!menuAnchor) return;
    if (!ensureCommentable(menuAnchor.startLine, menuAnchor.endLine)) {
      closeMenu();
      return;
    }
    startComment(
      file.path,
      menuAnchor.startLine,
      menuAnchor.endLine,
      menuAnchor.selectedText,
    );
    closeMenu();
  };

  const handleInsight = () => {
    if (!menuAnchor) return;
    openInsight({
      owner,
      repo,
      headRef,
      path: file.path,
      startLine: menuAnchor.startLine,
      endLine: menuAnchor.endLine,
      selectedText: menuAnchor.selectedText,
    });
    closeMenu();
  };

  const handleCloseInsight = () => {
    closeInsightStore();
    resetInsight();
  };

  const handleRate = (rating: "up" | "down") => {
    if (!insightReq) return;
    feedback.mutate({
      owner: insightReq.owner,
      repo: insightReq.repo,
      ref: insightReq.headRef,
      path: insightReq.path,
      startLine: insightReq.startLine,
      endLine: insightReq.endLine,
      selectedText: insightReq.selectedText,
      insight: insightAnswer,
      rating,
    });
  };

  const handleDeeper = () => {
    if (!insightReq) return;
    openInsight({ ...insightReq, deep: true });
  };

  useEffect(() => {
    triggerInsightRef.current = () => {
      const ed = editorRef.current;
      const model = ed?.getModel();
      const sel = ed?.getSelection();
      if (!ed || !model || !sel || sel.isEmpty()) return;
      openInsight({
        owner,
        repo,
        headRef,
        path: file.path,
        startLine: sel.startLineNumber,
        endLine: sel.endLineNumber,
        selectedText: model.getValueInRange(sel),
      });
      useSelectionMenu.getState().close();
    };
  }, [owner, repo, headRef, file.path, openInsight]);

  useEffect(() => {
    if (insightReq && insightReq.path === file.path) runInsight(insightReq);
  }, [insightReq, file.path, runInsight]);

  useEffect(() => {
    return () => {
      useSelectionMenu.getState().close();
      useInsightStore.getState().close();
    };
  }, []);

  useEffect(() => {
    const ed = editorRef.current;
    const container = containerRef.current;
    if (!mounted || !ed || !container || !pending || pending.path !== file.path) {
      setComposerPos(null);
      return;
    }
    setComposerPos(toContainerPoint(ed, container, pending.endLine, 1));
  }, [pending, file.path, mounted]);

  useEffect(() => {
    const collection = decorationsRef.current;
    if (!collection) return;
    const fileDrafts = drafts.filter((d) => d.path === file.path);
    collection.set(
      fileDrafts.map((d) => ({
        range: {
          startLineNumber: d.startLine ?? d.line,
          startColumn: 1,
          endLineNumber: d.line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          linesDecorationsClassName: "rev-comment-gutter",
          glyphMarginClassName: "rev-comment-glyph",
        },
      })),
    );
  }, [drafts, file.path, mounted]);

  useEffect(() => {
    const collection = commentsDecorationsRef.current;
    if (!collection) return;
    collection.set(
      fileThreads
        .filter((thread) => thread.line)
        .map((thread) => ({
          range: {
            startLineNumber: thread.line as number,
            startColumn: 1,
            endLineNumber: thread.line as number,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            linesDecorationsClassName: "rev-existing-comment-line",
            glyphMarginClassName: "rev-existing-comment",
          },
        })),
    );
  }, [fileThreads, mounted]);

  useEffect(() => {
    if (!mounted || !reveal || reveal.path !== file.path) return;
    if (reveal.nonce === lastRevealNonce.current) return;

    if (reveal.symbol) {
      const ed = editorRef.current;
      const model = ed?.getModel();
      if (!ed || !model) return;
      const matches = model.findMatches(
        `\\b${reveal.symbol}\\b`,
        false,
        true,
        true,
        null,
        false,
        1,
      );
      if (matches.length === 0) return;
      lastRevealNonce.current = reveal.nonce;
      const range = matches[0].range;
      ed.revealRangeInCenter(range);
      ed.setSelection(range);
      const hit = ed.createDecorationsCollection([
        { range, options: { className: "rev-usage-hit" } },
      ]);
      window.setTimeout(() => hit.clear(), 1800);
      return;
    }

    if (reveal.line) {
      let ed = editorRef.current;
      if (reveal.side === "base") ed = originalRef.current;
      if (!ed) return;
      lastRevealNonce.current = reveal.nonce;
      ed.revealLineInCenter(reveal.line);
      const hit = ed.createDecorationsCollection([
        {
          range: {
            startLineNumber: reveal.line,
            startColumn: 1,
            endLineNumber: reveal.line,
            endColumn: 1,
          },
          options: { isWholeLine: true, className: "rev-usage-hit" },
        },
      ]);
      window.setTimeout(() => hit.clear(), 1800);
    }
  }, [reveal, mounted, file.path]);

  if (base.isLoading || head.isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (base.isError || head.isError) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
        {base.error?.message ?? head.error?.message}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full">
      <DiffSurface
        isNew={isNew}
        path={file.path}
        diffMode={diffMode}
        original={base.data?.content ?? ""}
        modified={head.data?.content ?? ""}
        onDiffMount={handleDiffMount}
        onNewFileMount={handleNewFileMount}
      />
      {menuAnchor && menuAnchor.path === file.path && (
        <SelectionRadialMenu
          top={menuAnchor.top}
          left={menuAnchor.left}
          showComment={canReview}
          onComment={handleCommentClick}
          onInsight={handleInsight}
        />
      )}
      {composerPos && (
        <ReviewComposer top={composerPos.top} left={composerPos.left} />
      )}
      {openThread && number !== undefined && (
        <ThreadPopover
          thread={openThread.thread}
          owner={owner}
          repo={repo}
          number={number}
          top={openThread.top}
          left={openThread.left}
          onClose={handleCloseThread}
        />
      )}
      {insightReq && insightReq.path === file.path && (
        <InsightPanel
          key={`${insightReq.path}:${insightReq.startLine}:${insightReq.endLine}:${insightReq.whole ? "whole" : "sel"}`}
          path={insightReq.path}
          startLine={insightReq.startLine}
          endLine={insightReq.endLine}
          steps={insightSteps}
          files={insightFiles}
          answer={insightAnswer}
          isStreaming={insightStreaming}
          deep={Boolean(insightReq.deep)}
          onRate={handleRate}
          onDeeper={handleDeeper}
          onClose={handleCloseInsight}
        />
      )}
    </div>
  );
}

interface DiffSurfaceProps {
  isNew: boolean;
  path: string;
  diffMode: "split" | "inline";
  original: string;
  modified: string;
  onDiffMount(diffEditor: editor.IStandaloneDiffEditor, monaco: Monaco): void;
  onNewFileMount(ed: editor.IStandaloneCodeEditor, monaco: Monaco): void;
}

function DiffSurface({
  isNew,
  path,
  diffMode,
  original,
  modified,
  onDiffMount,
  onNewFileMount,
}: DiffSurfaceProps) {
  const language = languageForPath(path);

  if (isNew) {
    return (
      <MonacoEditor
        key={path}
        value={modified}
        language={language}
        theme="vs-dark"
        onMount={onNewFileMount}
        options={EDITOR_OPTIONS}
        loading={editorLoading()}
      />
    );
  }

  return (
    <DiffEditor
      key={`${path}:${diffMode}`}
      original={original}
      modified={modified}
      language={language}
      theme="vs-dark"
      onMount={onDiffMount}
      options={{ ...EDITOR_OPTIONS, renderSideBySide: diffMode === "split" }}
      loading={editorLoading()}
    />
  );
}

