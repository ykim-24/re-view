import { useEventStream } from "./useEventStream";

export interface VerifyCommentRequest {
  owner: string;
  repo: string;
  headRef: string;
  path: string;
  line: number | null;
  author: string;
  body: string;
  thread: { author: string; body: string }[];
}

/** Drives the /api/verify-comment pipeline (assessment + a suggested reply). */
export function useVerifyComment() {
  return useEventStream("/api/verify-comment");
}
