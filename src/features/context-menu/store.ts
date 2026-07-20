/** Transient store for the right-click context menu — one open menu at a time. */

import { create } from "zustand";
import type { ContextMenuPayload } from "./types";

interface ContextMenuState {
  active: (ContextMenuPayload & { id: number }) | null;
  open(payload: ContextMenuPayload): void;
  close(): void;
}

let counter = 0;

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  active: null,
  open: (payload) => {
    counter += 1;
    set({ active: { ...payload, id: counter } });
  },
  close: () => set({ active: null }),
}));

export function openContextMenu(payload: ContextMenuPayload) {
  useContextMenuStore.getState().open(payload);
}

export function closeContextMenu() {
  useContextMenuStore.getState().close();
}
