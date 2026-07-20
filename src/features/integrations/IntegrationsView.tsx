"use client";

/**
 * Integrations workspace (Phase A): a secrets vault plus a code-command editor
 * that runs server-side in a sandboxed vm with `fetch`/`secrets`/`log`, showing
 * verbose logs and the result. Saved commands live in local SQLite.
 */

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Save, Trash2, Pencil, Plus, FileCode } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/Loader";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/utils";
import { openModal } from "@/features/modal";
import { openContextMenu } from "@/features/context-menu";
import {
  useCommands,
  useCommandActions,
  useRunCommand,
} from "@/hooks/useIntegrations";
import { RunOutput } from "./RunOutput";
import { SecretsPanel } from "./SecretsPanel";
import type { Command } from "@/domain/integration/models";

const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.Editor),
  { ssr: false, loading: () => <Loader /> },
);

const STARTER = `// Available: fetch, secrets.get("NAME"), secrets.names(), log()/log.debug()/log.error().
// Return a value to show it as the result.
const key = secrets.get("SANDBOX_API_KEY");
const res = await fetch("https://api.example.com/deploy", {
  method: "POST",
  headers: { authorization: \`Bearer \${key}\` },
});
const data = await res.json();
log("deployed", data.id);
return data;
`;

export function IntegrationsView() {
  const { data } = useCommands();
  const { saveCommand, removeCommand } = useCommandActions();
  const run = useRunCommand();

  const [id, setId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled command");
  const [code, setCode] = useState(STARTER);

  const commands = data?.commands ?? [];

  const handleSelect = (cmd: Command) => {
    setId(cmd.id);
    setName(cmd.name);
    setCode(cmd.code);
    run.reset();
  };
  const handleNew = () => {
    setId(null);
    setName("Untitled command");
    setCode(STARTER);
    run.reset();
  };
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const handleCodeChange = (value?: string) => setCode(value ?? "");
  const handleSave = () => {
    saveCommand.mutate(
      { id: id ?? undefined, name: name.trim() || "Untitled command", code },
      { onSuccess: (res) => setId(res.id) },
    );
  };
  const handleRun = () => run.mutate(code);
  const handleRename = (cmdId: string, nextName: string) => {
    const cmd = commands.find((c) => c.id === cmdId);
    if (!cmd) return;
    const trimmed = nextName.trim() || cmd.name;
    saveCommand.mutate({ id: cmd.id, name: trimmed, code: cmd.code });
    if (cmd.id === id) setName(trimmed);
  };
  const handleRequestDelete = (cmdId: string) => {
    const cmd = commands.find((c) => c.id === cmdId);
    openModal({
      type: "confirm",
      title: "Delete command",
      message: `Delete "${cmd?.name ?? "this command"}"? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => {
        removeCommand.mutate(cmdId, {
          onSuccess: () => {
            if (cmdId === id) handleNew();
          },
        });
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Tooltip content="Home">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Tooltip>
        <div className="font-medium">Integrations</div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 space-y-6 overflow-y-auto border-r p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Commands</span>
              <Tooltip content="New command">
                <button
                  onClick={handleNew}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="New command"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
            <div className="space-y-1">
              {commands.map((cmd) => (
                <CommandRow
                  key={cmd.id}
                  cmd={cmd}
                  active={cmd.id === id}
                  onSelect={handleSelect}
                  onRename={handleRename}
                  onDelete={handleRequestDelete}
                />
              ))}
              {commands.length === 0 && (
                <div className="text-xs text-muted-foreground">No saved commands.</div>
              )}
            </div>
          </div>

          <SecretsPanel />
        </aside>

        <main className="flex min-h-0 flex-1 flex-col p-3">
          <div className="flex shrink-0 items-center gap-2 pb-2">
            <Input
              value={name}
              onChange={handleNameChange}
              placeholder="Command name"
              className="h-8 max-w-xs"
            />
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSave} className="gap-1.5">
                <Save className="h-4 w-4" />
                Save
              </Button>
              <Button size="sm" onClick={handleRun} disabled={run.isPending} className="gap-1.5">
                <Play className="h-4 w-4" />
                Run
              </Button>
            </div>
          </div>

          <div className="min-h-[200px] flex-1 overflow-hidden rounded-md border">
            <MonacoEditor
              value={code}
              language="javascript"
              theme="vs-dark"
              onChange={handleCodeChange}
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

          <div className="mt-3 max-h-[45vh] shrink-0 overflow-y-auto">
            <RunOutput result={run.data ?? null} isRunning={run.isPending} />
          </div>
        </main>
      </div>
    </div>
  );
}

interface CommandRowProps {
  cmd: Command;
  active: boolean;
  onSelect(cmd: Command): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
}

function CommandRow({ cmd, active, onSelect, onRename, onDelete }: CommandRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cmd.name);

  const startEditing = useCallback(() => {
    setDraft(cmd.name);
    setEditing(true);
  }, [cmd.name]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== cmd.name) onRename(cmd.id, next);
  };

  const handleSelect = () => onSelect(cmd);
  const handleDoubleClick = () => startEditing();
  const handleDelete = () => onDelete(cmd.id);
  const handleDraftChange = (e: React.ChangeEvent<HTMLInputElement>) => setDraft(e.target.value);
  const handleDraftFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();
  const handleDraftKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
    }
  };
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { id: "rename", label: "Rename", icon: Pencil, onSelect: startEditing },
        {
          id: "delete",
          label: "Delete",
          icon: Trash2,
          destructive: true,
          onSelect: handleDelete,
        },
      ],
    });
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={handleDraftChange}
        onFocus={handleDraftFocus}
        onKeyDown={handleDraftKeyDown}
        onBlur={commit}
        className="h-8 text-sm"
      />
    );
  }

  return (
    <div
      onContextMenu={handleContextMenu}
      className={cn(
        "group flex w-full items-center gap-1 rounded-md pr-1 text-sm",
        active && "bg-muted text-foreground",
        !active && "text-muted-foreground hover:bg-muted/60",
      )}
    >
      <button
        onClick={handleSelect}
        onDoubleClick={handleDoubleClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
      >
        <FileCode className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{cmd.name}</span>
      </button>
      <Tooltip content="Delete command">
        <button
          onClick={handleDelete}
          aria-label="Delete command"
          className="shrink-0 rounded p-1 text-muted-foreground/60 opacity-0 hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}
