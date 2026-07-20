/**
 * A reusable right-click context menu, driven by a registry like the modal one:
 * open it imperatively with a screen position + a list of items, and the always
 * mounted ContextMenuRoot renders/positions/dismisses it.
 */

import type { LucideIcon } from "lucide-react";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  onSelect(): void;
}

export interface ContextMenuPayload {
  x: number;
  y: number;
  items: ContextMenuItem[];
}
