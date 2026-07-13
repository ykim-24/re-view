import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { PullRequestData } from "@/domain/pull-request/models";

export function prKey(owner: string, repo: string, number: number) {
  return ["pr", owner, repo, number] as const;
}

export function usePullRequest(owner: string, repo: string, number: number) {
  return useQuery<PullRequestData>({
    queryKey: prKey(owner, repo, number),
    queryFn: () =>
      api.get<PullRequestData>(
        `/api/pr?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo,
        )}&number=${number}`,
      ),
  });
}
