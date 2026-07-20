/**
 * A component's event handlers — the logic "files" it holds, keyed by event id
 * in `config.handlers`. `config.primaryEvent` names the handler that runs when
 * the component is invoked (a button's click, `components.<key>.run()`). Falls
 * back to the legacy single `component.code` for components saved before this.
 */

import type { Component } from "./models";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function componentHandlers(component: Component): Record<string, string> {
  const raw = component.config.handlers;
  if (!isRecord(raw)) return {};
  const out: Record<string, string> = {};
  for (const [eventId, code] of Object.entries(raw)) {
    if (typeof code === "string") out[eventId] = code;
  }
  return out;
}

export function primaryEventId(component: Component): string {
  const value = component.config.primaryEvent;
  return typeof value === "string" && value ? value : "onClick";
}

export function handlerCode(component: Component, eventId: string): string {
  return componentHandlers(component)[eventId] ?? "";
}

export function primaryHandlerCode(component: Component): string {
  return handlerCode(component, primaryEventId(component)) || component.code;
}
