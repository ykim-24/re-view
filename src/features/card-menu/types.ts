/** Types for the right-click card menu (lifted card + slide-out actions). */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface CardAction {
  id: string;
  icon: LucideIcon;
  label: string;
  onSelect(): void;
  accent?: string;
}

export interface CardMenuRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface CardMenuPayload {
  rect: CardMenuRect;
  preview: ReactNode;
  actions: CardAction[];
}
