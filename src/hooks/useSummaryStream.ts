import { useEventStream } from "./useEventStream";

/** Drives the stepped /api/summary pipeline (read → resolve defs → write/update). */
export function useSummaryStream() {
  return useEventStream("/api/summary");
}
