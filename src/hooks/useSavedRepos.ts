import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { SavedRepo } from "@/domain/pull-request/models";

const REPOS_KEY = ["saved-repos"] as const;

export function useSavedRepos() {
  return useQuery<{ repos: SavedRepo[] }>({
    queryKey: REPOS_KEY,
    queryFn: () => api.get<{ repos: SavedRepo[] }>("/api/repos"),
  });
}

type RepoPayload =
  | { action: "save"; owner: string; repo: string }
  | { action: "remove"; key: string };

export function useRepoActions() {
  const qc = useQueryClient();
  const mutation = useMutation<{ repos: SavedRepo[] }, Error, RepoPayload>({
    mutationFn: (payload) => api.post<{ repos: SavedRepo[] }>("/api/repos", payload),
    onSuccess: (data) => qc.setQueryData(REPOS_KEY, data),
  });
  const { mutate } = mutation;
  const saveRepo = useCallback(
    (owner: string, repo: string) => mutate({ action: "save", owner, repo }),
    [mutate],
  );
  const removeRepo = useCallback(
    (key: string) => mutate({ action: "remove", key }),
    [mutate],
  );
  return { saveRepo, removeRepo };
}
