"use client";

/**
 * Editor panel for a single component: its reference key (how other components
 * address it), display name, and config (a button's label), plus its logic files
 * — one per event. Each file opens in the wide left drawer; new events are added
 * from the "Add logic" menu. The code itself is edited in the drawer, not here.
 */

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/Tooltip";
import { openContextMenu } from "@/features/context-menu";
import { componentKey, slugifyKey } from "@/domain/integration/component-key";
import { componentHandlers } from "@/domain/integration/component-handlers";
import { useState } from "react";
import type { Component, ComponentType } from "@/domain/integration/models";
import { specForType } from "./component-catalog";

interface ComponentSaveInput {
  id: string;
  type: ComponentType;
  name: string;
  config: Record<string, unknown>;
  code: string;
}

interface ComponentEditorProps {
  component: Component;
  busy: boolean;
  onSave(input: ComponentSaveInput): void;
  onAddLogic(eventId: string): void;
  onEditLogic(eventId: string): void;
}

function initialLabel(component: Component): string {
  const label = component.config.label;
  return typeof label === "string" ? label : "";
}

export function ComponentEditor({
  component,
  busy,
  onSave,
  onAddLogic,
  onEditLogic,
}: ComponentEditorProps) {
  const [name, setName] = useState(component.name);
  const [key, setKey] = useState(componentKey(component));
  const [label, setLabel] = useState(initialLabel(component));

  const spec = specForType(component.type);
  const handlers = componentHandlers(component);
  const presentEvents = spec ? spec.events.filter((e) => e.id in handlers) : [];
  const addableEvents = spec ? spec.events.filter((e) => !(e.id in handlers)) : [];

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const handleKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => setKey(e.target.value);
  const handleKeyBlur = () => setKey((current) => slugifyKey(current));
  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value);
  const handleSave = () => {
    onSave({
      id: component.id,
      type: component.type,
      name: name.trim() || "Untitled",
      config: { ...component.config, key: slugifyKey(key), label },
      code: component.code,
    });
  };
  const handleAddLogic = (e: React.MouseEvent) => {
    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: addableEvents.map((event) => ({
        id: event.id,
        label: event.label,
        icon: Plus,
        onSelect: () => onAddLogic(event.id),
      })),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Reference key</label>
        <Input value={key} onChange={handleKeyChange} onBlur={handleKeyBlur} className="h-8 font-mono" />
        <div className="text-xs text-muted-foreground">
          Address as <code>components.{slugifyKey(key)}</code>.
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Name</label>
        <Input value={name} onChange={handleNameChange} className="h-8" />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Label</label>
        <Input value={label} onChange={handleLabelChange} className="h-8" />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Logic</span>
          {addableEvents.length > 0 && (
            <button
              onClick={handleAddLogic}
              className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Add logic
            </button>
          )}
        </div>
        {presentEvents.map((event) => (
          <LogicFileRow key={event.id} eventId={event.id} label={event.label} onEdit={onEditLogic} />
        ))}
        {presentEvents.length === 0 && (
          <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            No logic yet. Add logic to define what this component does.
          </div>
        )}
      </div>

      <Button size="sm" onClick={handleSave} disabled={busy} className="gap-1.5 self-end">
        Save
      </Button>
    </div>
  );
}

interface LogicFileRowProps {
  eventId: string;
  label: string;
  onEdit(eventId: string): void;
}

function LogicFileRow({ eventId, label, onEdit }: LogicFileRowProps) {
  const handleEdit = () => onEdit(eventId);
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5">
      <span className="text-sm text-foreground">{label}</span>
      <Tooltip content="Edit logic">
        <button
          onClick={handleEdit}
          aria-label="Edit logic"
          className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit file
        </button>
      </Tooltip>
    </div>
  );
}
