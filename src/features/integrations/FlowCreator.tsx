"use client";

/**
 * Flow creator: place components on a flow, edit each one's config + logic, and
 * run a component's logic server-side (sandboxed, with `fetch`/`secrets`/`log`).
 * Layout/drag are intentionally minimal for now — components render in node
 * order; shared state between components lands next. First component: a button.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Play, Trash2, Pencil } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/utils";
import { openModal } from "@/features/modal";
import {
  useFlow,
  useComponents,
  useComponentActions,
  useFlowActions,
  useRunComponent,
} from "@/hooks/useIntegrationApps";
import type { Component, ComponentType, FlowNode } from "@/domain/integration/models";
import { componentKey, nextComponentKey } from "@/domain/integration/component-key";
import { componentHandlers } from "@/domain/integration/component-handlers";
import { ComponentEditor } from "./ComponentEditor";
import { ComponentPaletteModal } from "./ComponentPaletteModal";
import { LogicDrawer } from "./LogicDrawer";
import { specForType, eventLabel } from "./component-catalog";
import { RunOutput } from "./RunOutput";

function componentLabel(component: Component): string {
  const label = component.config.label;
  return typeof label === "string" && label.trim() ? label : component.name;
}

function nextOrder(nodes: FlowNode[]): number {
  return nodes.reduce((max, node) => Math.max(max, node.order), 0) + 1000;
}

interface FlowCreatorProps {
  integrationId: string;
  flowId: string;
}

export function FlowCreator({ integrationId, flowId }: FlowCreatorProps) {
  const { data } = useFlow(flowId);
  const { saveFlow } = useFlowActions(integrationId);
  const { saveComponent, removeComponent } = useComponentActions();
  const run = useRunComponent();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [ctx, setCtx] = useState<Record<string, unknown>>({});
  const [editing, setEditing] = useState<{ componentId: string; eventId: string } | null>(null);

  const flow = data?.flow ?? null;
  const orderedIds = useMemo(() => {
    if (!flow) return [];
    return [...flow.nodes].sort((a, b) => a.order - b.order).map((n) => n.id);
  }, [flow]);
  const { data: componentsData } = useComponents(orderedIds);

  const byId = new Map((componentsData?.components ?? []).map((c) => [c.id, c]));
  const components = orderedIds.map((id) => byId.get(id)).filter((c): c is Component => Boolean(c));
  const selected = selectedId ? (byId.get(selectedId) ?? null) : null;
  const editingComponent = editing ? (byId.get(editing.componentId) ?? null) : null;

  const handleOpenPalette = () => setPaletteOpen(true);
  const handlePick = (type: ComponentType) => {
    setPaletteOpen(false);
    if (!flow) return;
    const spec = specForType(type);
    if (!spec) return;
    const key = nextComponentKey(type, components.map(componentKey));
    saveComponent.mutate(
      {
        type,
        name: spec.label,
        config: { ...spec.defaultConfig, key, primaryEvent: spec.primaryEvent, handlers: {} },
        code: "",
      },
      {
        onSuccess: (res) => {
          saveFlow.mutate({
            id: flow.id,
            name: flow.name,
            description: flow.description,
            nodes: [...flow.nodes, { id: res.id, order: nextOrder(flow.nodes) }],
          });
          setSelectedId(res.id);
        },
      },
    );
  };

  const saveHandlers = (component: Component, handlers: Record<string, string>) => {
    saveComponent.mutate({
      id: component.id,
      type: component.type,
      name: component.name,
      config: { ...component.config, handlers },
      code: component.code,
    });
  };
  const handleAddLogic = (eventId: string) => {
    if (!selected) return;
    const spec = specForType(selected.type);
    const defaultCode = spec?.events.find((e) => e.id === eventId)?.defaultCode ?? "";
    saveHandlers(selected, { ...componentHandlers(selected), [eventId]: defaultCode });
    setEditing({ componentId: selected.id, eventId });
  };
  const handleEditLogic = (eventId: string) => {
    if (!selected) return;
    setEditing({ componentId: selected.id, eventId });
  };
  const handleSaveLogic = (code: string) => {
    if (!editing) return;
    const component = byId.get(editing.componentId);
    if (!component) return;
    saveHandlers(component, { ...componentHandlers(component), [editing.eventId]: code });
  };
  const handleCloseLogic = () => setEditing(null);

  const handleSelect = (id: string) => setSelectedId(id);
  const handleRun = (component: Component) => {
    run.mutate(
      { flowId, entryId: component.id, ctx },
      { onSuccess: (data) => setCtx(data.ctx) },
    );
  };
  const handleResetState = () => setCtx({});
  const handleRequestDelete = (id: string) => {
    if (!flow) return;
    const component = byId.get(id);
    openModal({
      type: "confirm",
      title: "Delete component",
      message: `Delete "${component ? componentLabel(component) : "this component"}"? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => {
        saveFlow.mutate({
          id: flow.id,
          name: flow.name,
          description: flow.description,
          nodes: flow.nodes.filter((n) => n.id !== id),
        });
        removeComponent.mutate(id);
        if (selectedId === id) setSelectedId(null);
      },
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Tooltip content="Back">
          <Link
            href={`/integrations/${integrationId}`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Tooltip>
        <div className="font-medium">{flow?.name ?? "Flow"}</div>
        <Button size="sm" onClick={handleOpenPalette} className="ml-auto gap-1.5">
          <Plus className="h-4 w-4" />
          Add component
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              selected={component.id === selectedId}
              onSelect={handleSelect}
              onRun={handleRun}
              onDelete={handleRequestDelete}
            />
          ))}
          {components.length === 0 && (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              No components yet. Add a component to start.
            </div>
          )}
        </div>

        <aside className="flex w-96 shrink-0 flex-col overflow-y-auto border-l">
          {selected && (
            <ComponentEditor
              key={selected.id}
              component={selected}
              busy={saveComponent.isPending}
              onSave={saveComponent.mutate}
              onAddLogic={handleAddLogic}
              onEditLogic={handleEditLogic}
            />
          )}
          {!selected && (
            <div className="p-4 text-sm text-muted-foreground">
              Select a component to edit its logic.
            </div>
          )}
          <SharedStateViewer ctx={ctx} onReset={handleResetState} />
          <div className="border-t p-3">
            <RunOutput result={run.data ?? null} isRunning={run.isPending} />
          </div>
        </aside>
      </div>

      <ComponentPaletteModal open={paletteOpen} onOpenChange={setPaletteOpen} onPick={handlePick} />
      {editing && editingComponent && (
        <LogicDrawer
          key={`${editing.componentId}:${editing.eventId}`}
          component={editingComponent}
          eventId={editing.eventId}
          title={eventLabel(specForType(editingComponent.type), editing.eventId)}
          componentKeys={components.map(componentKey)}
          busy={saveComponent.isPending}
          onSave={handleSaveLogic}
          onClose={handleCloseLogic}
        />
      )}
    </div>
  );
}

interface ComponentCardProps {
  component: Component;
  selected: boolean;
  onSelect(id: string): void;
  onRun(component: Component): void;
  onDelete(id: string): void;
}

function ComponentCard({ component, selected, onSelect, onRun, onDelete }: ComponentCardProps) {
  const handleSelect = () => onSelect(component.id);
  const handleRun = () => onRun(component);
  const handleDelete = () => onDelete(component.id);
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3",
        selected && "border-blue-500/60 ring-1 ring-blue-500/30",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          {componentKey(component)}
        </span>
        <span className="truncate text-sm text-foreground">{component.name}</span>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip content="Edit">
            <button
              onClick={handleSelect}
              aria-label="Edit component"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Delete">
            <button
              onClick={handleDelete}
              aria-label="Delete component"
              className="rounded p-1 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
      {component.type === "button" && (
        <button
          onClick={handleRun}
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Play className="h-3.5 w-3.5" />
          {componentLabel(component)}
        </button>
      )}
      {component.type !== "button" && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleRun}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:border-blue-500/50 hover:text-foreground"
          >
            <Play className="h-3.5 w-3.5" />
            Run
          </button>
          <span className="text-xs text-muted-foreground">Connector — runs other components in order.</span>
        </div>
      )}
    </div>
  );
}

interface SharedStateViewerProps {
  ctx: Record<string, unknown>;
  onReset(): void;
}

function SharedStateViewer({ ctx, onReset }: SharedStateViewerProps) {
  const isEmpty = Object.keys(ctx).length === 0;
  return (
    <div className="border-t p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Shared state
        </span>
        {!isEmpty && (
          <button
            onClick={onReset}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>
      {isEmpty && (
        <div className="text-xs text-muted-foreground">
          Empty. Components read and write <code>ctx</code> to share state.
        </div>
      )}
      {!isEmpty && (
        <pre className="max-h-40 overflow-auto rounded-md bg-tab-strip p-2 font-mono text-xs shadow-[inset_0_1px_3px_rgba(0,0,0,0.55)]">
          {JSON.stringify(ctx, null, 2)}
        </pre>
      )}
    </div>
  );
}
