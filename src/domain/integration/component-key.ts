/**
 * A component's reference key: the stable, human-facing handle used to reference
 * it from other components (`components.<key>`, `ctx.<key>`). Distinct from the
 * uuid `id` (which owns flow membership). Keys are valid JS identifiers, unique
 * within a flow, and auto-generated from the type on create.
 */

import type { Component, ComponentType } from "./models";

export function slugifyKey(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_]/g, "");
  const noLeadingDigit = cleaned.replace(/^[0-9]+/, "");
  return noLeadingDigit || "component";
}

export function componentKey(component: Component): string {
  const key = component.config.key;
  if (typeof key === "string" && key.trim()) return slugifyKey(key);
  return `c${component.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8)}`;
}

export function nextComponentKey(type: ComponentType, existingKeys: string[]): string {
  const taken = new Set(existingKeys);
  let n = 1;
  let candidate = `${type}${n}`;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${type}${n}`;
  }
  return candidate;
}
