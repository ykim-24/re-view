import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { PrCommit } from "@/domain/pull-request/models";

export function usePrCommits(owner: string, repo: string, number: number) {
  return useQuery<{ commits: PrCommit[] }>({
    queryKey: ["commits", owner, repo, number],
    queryFn: () =>
      api.get<{ commits: PrCommit[] }>(
        `/api/commits?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo,
        )}&number=${number}`,
      ),
  });
}
