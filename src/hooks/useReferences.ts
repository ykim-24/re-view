import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { CodeReference } from "@/domain/pull-request/models";

/** Repo-wide code-search references for a symbol (GitHub default branch). */
export function useReferences(owner: string, repo: string, symbol: string | null) {
  return useQuery<{ references: CodeReference[] }>({
    queryKey: ["references", owner, repo, symbol],
    enabled: Boolean(symbol) && symbol!.length >= 2,
    queryFn: () =>
      api.post<{ references: CodeReference[] }>("/api/references", {
        owner,
        repo,
        symbol,
      }),
  });
}
