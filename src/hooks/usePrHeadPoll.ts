import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

/**
 * Polls the PR's current head SHA on an interval so the workspace can flag when
 * the PR has new commits since the loaded snapshot.
 */
export function usePrHeadPoll(owner: string, repo: string, number: number) {
  return useQuery<{ sha: string }>({
    queryKey: ["pr-head", owner, repo, number],
    queryFn: () =>
      api.get<{ sha: string }>(
        `/api/pr-head?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo,
        )}&number=${number}`,
      ),
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });
}
