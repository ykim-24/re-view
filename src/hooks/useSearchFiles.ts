import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { SearchMatch } from "@/application/search-files";

export function useSearchFiles(
  owner: string,
  repo: string,
  ref: string,
  paths: string[],
  query: string,
) {
  const trimmed = query.trim();
  return useQuery<{ matches: SearchMatch[] }>({
    queryKey: ["search", owner, repo, ref, trimmed],
    enabled: trimmed.length >= 2 && paths.length > 0 && Boolean(ref),
    queryFn: () =>
      api.post<{ matches: SearchMatch[] }>("/api/search", {
        owner,
        repo,
        ref,
        paths,
        query: trimmed,
      }),
  });
}
