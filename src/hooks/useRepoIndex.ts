import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

export interface RepoIndexStatus {
  repoKey: string;
  headSha: string;
  status: "building" | "ready" | "error";
  fileCount: number;
  symbolCount: number;
  message: string | null;
  indexedAt: string;
}

/**
 * Kicks a background build of the repo symbol index on mount (idempotent on the
 * server) and polls its status while it builds. Powers repo-wide go-to-definition.
 */
export function useRepoIndex(owner: string, repo: string) {
  const qc = useQueryClient();

  const ensure = useMutation<RepoIndexStatus, Error, void>({
    mutationFn: () =>
      api.post<RepoIndexStatus>("/api/index/ensure", { owner, repo }),
    onSuccess: (meta) => qc.setQueryData(["repo-index", owner, repo], meta),
  });

  const ensureMutate = ensure.mutate;
  useEffect(() => {
    ensureMutate();
  }, [owner, repo, ensureMutate]);

  return useQuery<RepoIndexStatus | null>({
    queryKey: ["repo-index", owner, repo],
    queryFn: () =>
      api.get<RepoIndexStatus | null>(
        `/api/index/status?owner=${encodeURIComponent(
          owner,
        )}&repo=${encodeURIComponent(repo)}`,
      ),
    refetchInterval: (query) =>
      query.state.data?.status === "building" ? 1500 : false,
  });
}
