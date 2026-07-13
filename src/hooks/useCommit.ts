import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { CommitDetail } from "@/domain/pull-request/models";

export function useCommit(owner: string, repo: string, sha: string | null) {
  return useQuery<CommitDetail>({
    queryKey: ["commit", owner, repo, sha],
    enabled: Boolean(sha),
    queryFn: () =>
      api.get<CommitDetail>(
        `/api/commit?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo,
        )}&sha=${sha}`,
      ),
  });
}
