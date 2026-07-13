import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { PrComments } from "@/domain/pull-request/models";

export function usePrComments(
  owner: string,
  repo: string,
  number: number | undefined,
) {
  return useQuery<PrComments>({
    queryKey: ["comments", owner, repo, number],
    enabled: number !== undefined,
    queryFn: () =>
      api.get<PrComments>(
        `/api/comments?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo,
        )}&number=${number}`,
      ),
  });
}
