/**
 * The catalog of component types we support, grouped by category. Each entry
 * declares its events (each a logic "file" with seed code), which event runs
 * when the component is invoked, its default config, and how it presents in the
 * palette. Adding a component type = adding an entry here.
 */

import { MousePointerClick, ListOrdered, type LucideIcon } from "lucide-react";
import type { ComponentType } from "@/domain/integration/models";

export type ComponentCategory = "Buttons" | "Sequences";

export interface ComponentEvent {
  id: string;
  label: string;
  defaultCode: string;
}

export interface ComponentSpec {
  type: ComponentType;
  label: string;
  description: string;
  category: ComponentCategory;
  icon: LucideIcon;
  defaultConfig: Record<string, unknown>;
  events: ComponentEvent[];
  primaryEvent: string;
}

const BUTTON_CODE = `// Runs when the button is clicked.
// Available: fetch, secrets.get("NAME"), secrets.names(), log(), ctx, components.<key>.
log("clicked");
return "ok";
`;

const SEQUENCE_CODE = `// Runs other components in order, e.g.:
// await components.stepOne.run();
// await components.stepTwo.run();
return "done";
`;

export const COMPONENT_CATALOG: ComponentSpec[] = [
  {
    type: "button",
    label: "Button",
    description: "A clickable button — write the logic that runs on click.",
    category: "Buttons",
    icon: MousePointerClick,
    defaultConfig: { label: "Button" },
    events: [{ id: "onClick", label: "On click", defaultCode: BUTTON_CODE }],
    primaryEvent: "onClick",
  },
  {
    type: "sequence",
    label: "Sequence",
    description: "Chain other components' events in order. Not rendered.",
    category: "Sequences",
    icon: ListOrdered,
    defaultConfig: {},
    events: [{ id: "onRun", label: "On run", defaultCode: SEQUENCE_CODE }],
    primaryEvent: "onRun",
  },
];

export const COMPONENT_CATEGORIES: ComponentCategory[] = ["Buttons", "Sequences"];

export function specForType(type: ComponentType): ComponentSpec | undefined {
  return COMPONENT_CATALOG.find((spec) => spec.type === type);
}

export function eventLabel(spec: ComponentSpec | undefined, eventId: string): string {
  return spec?.events.find((e) => e.id === eventId)?.label ?? eventId;
}
