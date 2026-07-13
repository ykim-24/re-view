import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type {
  PrStateFilter,
  PullRequestSummary,
} from "@/domain/pull-request/models";

export function usePullRequests(
  owner: string,
  repo: string,
  state: PrStateFilter,
) {
  return useQuery<{ prs: PullRequestSummary[] }>({
    queryKey: ["prs", owner, repo, state],
    queryFn: () =>
      api.get<{ prs: PullRequestSummary[] }>(
        `/api/prs?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo,
        )}&state=${state}`,
      ),
  });
}
