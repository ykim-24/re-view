"use client";

/**
 * Right-side drawer that peeks a cited file at a line — opened from summary source
 * traces, mirroring the go-to-definition panel. Read-only; fetches the file at the
 * view's head and highlights the referenced line. Slides in when `peek` is set.
 */

import dynamic from "next/dynamic";
import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { X, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader } from "@/components/Loader";
import { useWorkspaceStore } from "@/features/workspace/store";
import { useFileContent } from "@/hooks/useFileContent";
import { languageForPath } from "@/lib/language";
import { disableBuiltInCodeNav } from "@/lib/monaco";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> },
);

interface FilePeekPanelProps {
  owner: string;
  repo: string;
  headRef: string;
}

export function FilePeekPanel({ owner, repo, headRef }: FilePeekPanelProps) {
  const peek = useWorkspaceStore((s) => s.peek);
  const close = useWorkspaceStore((s) => s.closePeek);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const open = peek !== null;

  const file = useFileContent(owner, repo, peek?.path ?? null, headRef, open);

  useGSAP(
    () => {
      if (!panelRef.current) return;
      gsap.to(panelRef.current, {
        x: open ? 0 : "100%",
        duration: open ? 0.35 : 0.25,
        ease: open ? "power3.out" : "power3.in",
      });
    },
    { dependencies: [open] },
  );

  const location = peek?.line ? `${peek.path}:${peek.line}` : peek?.path;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-0 z-30 flex h-full w-[44%] min-w-[360px] max-w-[640px] translate-x-full flex-col border-l bg-background shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <FileCode className="h-4 w-4 shrink-0 text-sky-400" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs text-muted-foreground">{location}</div>
        </div>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {peek && (
          <PeekBody
            content={file.data?.content ?? null}
            isLoading={file.isLoading}
            isError={file.isError}
            path={peek.path}
            line={peek.line}
          />
        )}
      </div>
    </div>
  );
}

interface PeekBodyProps {
  content: string | null;
  isLoading: boolean;
  isError: boolean;
  path: string;
  line?: number;
}

function PeekBody({ content, isLoading, isError, path, line }: PeekBodyProps) {
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader label="Opening file…" />
      </div>
    );
  }
  if (isError || content === null) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Couldn’t open this file.
      </div>
    );
  }
  return <PeekEditor content={content} path={path} line={line ?? 1} />;
}

interface PeekEditorProps {
  content: string;
  path: string;
  line: number;
}

function PeekEditor({ content, path, line }: PeekEditorProps) {
  const handleMount = (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    disableBuiltInCodeNav(monaco);
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: 1 });
    ed.createDecorationsCollection([
      {
        range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
        options: {
          isWholeLine: true,
          className: "rev-def-bg",
          linesDecorationsClassName: "rev-added-gutter",
        },
      },
    ]);
  };

  return (
    <MonacoEditor
      key={`${path}:${line}`}
      value={content}
      language={languageForPath(path)}
      theme="vs-dark"
      onMount={handleMount}
      options={{
        readOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineHeight: 20,
        fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
        overviewRulerLanes: 0,
      }}
      loading={<Loader />}
    />
  );
}
