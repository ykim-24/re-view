import { create } from "zustand";

/**
 * Open/close state for the selection action wheel. Kept in a store so any
 * trigger — the Monaco ⌘K/⌘I commands, the pills, or opening a composer/insight
 * — can close it without prop-drilling or stale editor closures. The anchor
 * carries the selection it was opened for (and which file), so the right diff
 * renders it.
 */

export interface SelectionAnchor {
  path: string;
  startLine: number;
  endLine: number;
  top: number;
  left: number;
  selectedText: string;
}

interface SelectionMenuState {
  anchor: SelectionAnchor | null;
  open(anchor: SelectionAnchor): void;
  close(): void;
}

export const useSelectionMenu = create<SelectionMenuState>((set) => ({
  anchor: null,
  open: (anchor) => set({ anchor }),
  close: () => set({ anchor: null }),
}));
