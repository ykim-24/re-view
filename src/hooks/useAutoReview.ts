import { useEventStream } from "./useEventStream";

export interface AutoReviewRequest {
  owner: string;
  repo: string;
  number: number;
}

/** Drives the stepped /api/auto-review pipeline (steps + gathered files + review). */
export function useAutoReview() {
  return useEventStream("/api/auto-review");
}
