"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";
import { X, FileSearch, MessageSquarePlus, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader } from "@/components/Loader";
import { Tooltip } from "@/components/Tooltip";
import { ViewedToggle } from "@/features/review/ViewedToggle";
import { useWorkspaceStore } from "@/features/workspace/store";
import { languageForPath } from "@/lib/language";
import { disableBuiltInCodeNav } from "@/lib/monaco";
import { DrawerCommentBox } from "./DrawerCommentBox";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> },
);

function formatLocation(path: string, line?: number): string {
  if (!line) return path;
  return `${path}:${line}`;
}

interface CodeIntelPanelProps {
  paths: string[];
}

export function CodeIntelPanel({ paths }: CodeIntelPanelProps) {
  const definition = useWorkspaceStore((s) => s.definition);
  const close = useWorkspaceStore((s) => s.closeDefinition);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [commenting, setCommenting] = useState(false);
  const open = definition !== null;

  const symbol = definition?.symbol;
  const result = definition?.result ?? null;
  const defPath = result?.path ?? null;
  const defLine = result?.line ?? null;
  const defEndLine = result?.endLine ?? result?.line ?? null;
  const canComment = Boolean(defPath && defLine && paths.includes(defPath));

  const [prevSymbol, setPrevSymbol] = useState(symbol);
  if (symbol !== prevSymbol) {
    setPrevSymbol(symbol);
    setCommenting(false);
  }

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

  const openComment = () => setCommenting(true);
  const closeComment = () => setCommenting(false);

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-0 z-20 flex h-full w-[44%] min-w-[360px] max-w-[640px] translate-x-full flex-col border-l bg-background shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <FileSearch className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{symbol}</div>
          {defPath && (
            <div className="truncate text-xs text-muted-foreground">
              {formatLocation(defPath, defLine ?? undefined)}
            </div>
          )}
        </div>
        {defPath && <ViewedToggle path={defPath} />}
        {canComment && <CommentButton onClick={openComment} />}
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {definition && <PanelBody definition={definition} />}
      </div>

      {commenting && defPath && defLine && defEndLine && (
        <DrawerCommentBox
          path={defPath}
          line={defLine}
          endLine={defEndLine}
          onClose={closeComment}
        />
      )}
    </div>
  );
}

interface CommentButtonProps {
  onClick(): void;
}

function CommentButton({ onClick }: CommentButtonProps) {
  return (
    <Tooltip content="Comment on this definition">
      <Button variant="ghost" size="icon" onClick={onClick} aria-label="Comment">
        <MessageSquarePlus className="h-4 w-4" />
      </Button>
    </Tooltip>
  );
}

function PanelBody({
  definition,
}: {
  definition: NonNullable<ReturnType<typeof useWorkspaceStore.getState>["definition"]>;
}) {
  if (definition.status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader label="Finding definition…" />
      </div>
    );
  }

  if (definition.status === "error") {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
        {definition.message ?? "Could not resolve."}
      </div>
    );
  }

  const result = definition.result;
  if (!result) return null;

  if (result.kind === "external" || result.kind === "unresolved" || !result.content) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <PackageOpen className="h-6 w-6" />
        <p>{result.message ?? `Couldn't open "${definition.symbol}".`}</p>
        {result.specifier && (
          <code className="rounded bg-muted px-2 py-1 text-xs">
            {result.specifier}
          </code>
        )}
      </div>
    );
  }

  return (
    <DefinitionEditor
      content={result.content}
      path={result.path ?? "definition"}
      line={result.line ?? 1}
      endLine={result.endLine ?? result.line ?? 1}
    />
  );
}

function DefinitionEditor({
  content,
  path,
  line,
  endLine,
}: {
  content: string;
  path: string;
  line: number;
  endLine: number;
}) {
  const handleMount = (ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    disableBuiltInCodeNav(monaco);
    ed.revealLineInCenter(line);
    ed.setPosition({ lineNumber: line, column: 1 });
    ed.createDecorationsCollection([
      {
        range: { startLineNumber: line, startColumn: 1, endLineNumber: endLine, endColumn: 1 },
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
