"use client";

/**
 * A wide drawer that slides in from the left to edit one of a component's logic
 * files (an event handler) in a roomy Monaco editor with runtime autocomplete
 * (`ctx`, `secrets`, `log`, `components.<key>`). Save persists the handler;
 * clicking the backdrop or Escape closes.
 */

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Save, X } from "lucide-react";
import type { Monaco, OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { Tooltip } from "@/components/Tooltip";
import { applyFlowGlobals } from "@/lib/monaco-flow";
import { handlerCode } from "@/domain/integration/component-handlers";
import type { Component } from "@/domain/integration/models";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  { ssr: false, loading: () => <Loader /> },
);

interface LogicDrawerProps {
  component: Component;
  eventId: string;
  title: string;
  componentKeys: string[];
  busy: boolean;
  onSave(code: string): void;
  onClose(): void;
}

export function LogicDrawer({
  component,
  eventId,
  title,
  componentKeys,
  busy,
  onSave,
  onClose,
}: LogicDrawerProps) {
  const [code, setCode] = useState(() => handlerCode(component, eventId));
  const monacoRef = useRef<Monaco | null>(null);
  const keysSig = componentKeys.join(",");

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (monacoRef.current) {
      applyFlowGlobals(monacoRef.current, keysSig ? keysSig.split(",") : []);
    }
  }, [keysSig]);

  const handleMount: OnMount = (_editor, monaco) => {
    monacoRef.current = monaco;
    applyFlowGlobals(monaco, keysSig ? keysSig.split(",") : []);
  };
  const handleCodeChange = (value?: string) => setCode(value ?? "");
  const handleSave = () => onSave(code);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex">
      <div className="flex h-full w-full max-w-4xl flex-col border-r bg-background shadow-2xl">
        <header className="flex items-center gap-3 border-b px-4 py-2.5">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {component.name}
          </span>
          <span className="font-medium">{title}</span>
          <Button size="sm" onClick={handleSave} disabled={busy} className="ml-auto gap-1.5">
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Tooltip content="Close">
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </Tooltip>
        </header>
        <div className="min-h-0 flex-1">
          <MonacoEditor
            value={code}
            language="javascript"
            theme="vs-dark"
            onChange={handleCodeChange}
            onMount={handleMount}
            options={{
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
            }}
            loading={<Loader />}
          />
        </div>
      </div>
      <div className="flex-1 bg-black/40" onMouseDown={onClose} />
    </div>,
    document.body,
  );
}
