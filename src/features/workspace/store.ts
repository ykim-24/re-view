import { create } from "zustand";
import type { ResolveSymbolResult } from "@/application/resolve-symbol";

export type DiffMode = "split" | "inline";

export interface DefinitionPanel {
  /** the clicked symbol */
  symbol: string;
  status: "loading" | "ready" | "error";
  result: ResolveSymbolResult | null;
  message?: string;
}

interface WorkspaceState {
  /** changed file currently shown in the diff viewer */
  selectedPath: string | null;
  diffMode: DiffMode;
  /** right-side go-to-definition panel; null = closed (Flow's `?node=` pattern) */
  definition: DefinitionPanel | null;

  selectFile(path: string): void;
  setDiffMode(mode: DiffMode): void;
  toggleDiffMode(): void;

  openDefinition(symbol: string): void;
  setDefinitionResult(result: ResolveSymbolResult): void;
  setDefinitionError(message: string): void;
  closeDefinition(): void;

  /** request the diff viewer to scroll to a symbol usage or a specific line */
  reveal: RevealRequest | null;
  requestReveal(path: string, symbol: string): void;
  requestRevealLine(path: string, line: number, side: "head" | "base"): void;

  /** a commit being viewed in isolation (its own diff); null = normal PR review */
  commitSha: string | null;
  viewCommit(sha: string): void;
  closeCommit(): void;

  /** a cited file/line peeked in the right drawer (e.g. from a summary trace) */
  peek: { path: string; line?: number } | null;
  openPeek(path: string, line?: number): void;
  closePeek(): void;
}

export interface RevealRequest {
  path: string;
  nonce: number;
  symbol?: string;
  line?: number;
  side?: "head" | "base";
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedPath: null,
  diffMode: "inline",
  definition: null,

  selectFile: (path) => set({ selectedPath: path }),
  setDiffMode: (mode) => set({ diffMode: mode }),
  toggleDiffMode: () =>
    set((s) => ({ diffMode: s.diffMode === "split" ? "inline" : "split" })),

  openDefinition: (symbol) =>
    set({ definition: { symbol, status: "loading", result: null } }),
  setDefinitionResult: (result) =>
    set((s) =>
      s.definition
        ? { definition: { ...s.definition, status: "ready", result } }
        : {},
    ),
  setDefinitionError: (message) =>
    set((s) =>
      s.definition
        ? { definition: { ...s.definition, status: "error", message } }
        : {},
    ),
  closeDefinition: () => set({ definition: null }),

  reveal: null,
  requestReveal: (path, symbol) =>
    set((s) => ({
      reveal: { path, symbol, nonce: (s.reveal?.nonce ?? 0) + 1 },
    })),
  requestRevealLine: (path, line, side) =>
    set((s) => ({
      reveal: { path, line, side, nonce: (s.reveal?.nonce ?? 0) + 1 },
    })),

  commitSha: null,
  viewCommit: (sha) => set({ commitSha: sha }),
  closeCommit: () => set({ commitSha: null }),

  peek: null,
  openPeek: (path, line) => set({ peek: { path, line } }),
  closePeek: () => set({ peek: null }),
}));
