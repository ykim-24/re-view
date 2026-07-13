import { useEventStream } from "./useEventStream";

export type { InsightStep } from "./useEventStream";

export interface InsightRequest {
  owner: string;
  repo: string;
  headRef: string;
  path: string;
  startLine: number;
  endLine: number;
  selectedText: string;
  deep?: boolean;
  whole?: boolean;
}

/** Drives the stepped /api/insight pipeline (steps + gathered files + answer). */
export function useInsight() {
  return useEventStream("/api/insight");
}
