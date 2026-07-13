import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

export interface InsightFeedbackInput {
  owner: string;
  repo: string;
  ref: string;
  path: string;
  startLine: number;
  endLine: number;
  selectedText: string;
  insight: string;
  rating: "up" | "down";
}

/** Records a thumbs up/down on an insight for later quality evaluation. */
export function useInsightFeedback() {
  return useMutation<{ ok: boolean }, Error, InsightFeedbackInput>({
    mutationFn: (input) =>
      api.post<{ ok: boolean }>("/api/insight/feedback", input),
  });
}
