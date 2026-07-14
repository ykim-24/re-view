/** Transient store for the right-click card menu — one open menu at a time. */

import { create } from "zustand";
import type { CardMenuPayload } from "./types";

interface CardMenuState {
  active: (CardMenuPayload & { id: number }) | null;
  open(payload: CardMenuPayload): void;
  close(): void;
}

let counter = 0;

export const useCardMenuStore = create<CardMenuState>((set) => ({
  active: null,
  open: (payload) => {
    counter += 1;
    set({ active: { ...payload, id: counter } });
  },
  close: () => set({ active: null }),
}));

export function openCardMenu(payload: CardMenuPayload) {
  useCardMenuStore.getState().open(payload);
}

export function closeCardMenu() {
  useCardMenuStore.getState().close();
}
