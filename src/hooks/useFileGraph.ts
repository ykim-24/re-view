import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { DependencyGraph } from "@/domain/dependency-graph/build-graph";

/**
 * Resolves the imports of a single changed file on demand — used to populate a
 * tree row only when it's expanded, instead of resolving every file up front.
 * Keyed per path (the whole-tree hook keyed only by count, which would collide),
 * and cached forever since deps at an immutable ref never change.
 */
export function useFileGraph(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  patch: string | undefined,
  enabled: boolean,
) {
  return useQuery<DependencyGraph>({
    queryKey: ["file-graph", owner, repo, ref, path],
    enabled: enabled && Boolean(ref) && Boolean(path),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    queryFn: () =>
      api.post<DependencyGraph>("/api/graph", {
        owner,
        repo,
        ref,
        files: [{ path, patch }],
      }),
  });
}
