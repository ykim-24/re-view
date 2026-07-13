import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { BranchList } from "@/domain/branch/models";

export function useBranches(owner: string, repo: string) {
  return useQuery<BranchList>({
    queryKey: ["branches", owner, repo],
    queryFn: () =>
      api.get<BranchList>(
        `/api/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo,
        )}`,
      ),
  });
}
