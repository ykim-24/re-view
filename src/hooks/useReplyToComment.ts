import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { PrComment } from "@/domain/pull-request/models";

interface ReplyInput {
  commentId: number;
  body: string;
}

export function useReplyToComment(owner: string, repo: string, number: number) {
  const qc = useQueryClient();
  return useMutation<PrComment, Error, ReplyInput>({
    mutationFn: (input) =>
      api.post<PrComment>("/api/comments/reply", {
        owner,
        repo,
        number,
        commentId: input.commentId,
        body: input.body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", owner, repo, number] });
    },
  });
}
