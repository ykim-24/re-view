import { create } from "zustand";
import type { InsightRequest } from "@/hooks/useInsight";

/**
 * The active insight request. Held in a store so it can be opened from anywhere
 * — the selection wheel, the ⌘I command, or the file-level button outside the
 * editor — while the diff that owns the file renders and runs it. The request's
 * path decides which diff handles it.
 */
interface InsightStoreState {
  request: InsightRequest | null;
  open(request: InsightRequest): void;
  close(): void;
}

export const useInsightStore = create<InsightStoreState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));
