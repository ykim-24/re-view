import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { prKey } from "./usePullRequest";
import type { SubmitReviewInput } from "@/domain/pull-request/models";

export interface SubmitReviewResult {
  id: number;
  url: string;
}

export function useSubmitReview(owner: string, repo: string, number: number) {
  const qc = useQueryClient();
  return useMutation<SubmitReviewResult, Error, SubmitReviewInput>({
    mutationFn: (input) => api.post<SubmitReviewResult>("/api/review", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: prKey(owner, repo, number) });
    },
  });
}
