import { create } from "zustand";
import type { ModalDescriptor } from "./types";

interface ModalState {
  active: ModalDescriptor | null;
  open(descriptor: ModalDescriptor): void;
  close(): void;
}

export const useModalStore = create<ModalState>((set) => ({
  active: null,
  open: (descriptor) => set({ active: descriptor }),
  close: () => set({ active: null }),
}));

/** Imperative helpers so non-component code can drive modals. */
export function openModal(descriptor: ModalDescriptor) {
  useModalStore.getState().open(descriptor);
}

export function closeModal() {
  useModalStore.getState().close();
}
