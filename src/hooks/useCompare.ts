import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { CompareData } from "@/domain/branch/models";

export function useCompare(
  owner: string,
  repo: string,
  base: string,
  head: string,
) {
  return useQuery<CompareData>({
    queryKey: ["compare", owner, repo, base, head],
    enabled: Boolean(base) && Boolean(head),
    queryFn: () =>
      api.get<CompareData>(
        `/api/compare?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo,
        )}&base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`,
      ),
  });
}
