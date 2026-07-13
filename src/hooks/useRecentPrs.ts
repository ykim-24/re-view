import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { DashboardPr } from "@/domain/pull-request/models";

export function useRecentPrs(owner: string, repo: string) {
  return useQuery<{ recent: DashboardPr[] }>({
    queryKey: ["recent", owner, repo],
    queryFn: () =>
      api.get<{ recent: DashboardPr[] }>(
        `/api/recent?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
      ),
  });
}

export function useRecordRecent() {
  const qc = useQueryClient();
  const mutation = useMutation<{ recent: DashboardPr[] }, Error, DashboardPr>({
    mutationFn: (pr) => api.post<{ recent: DashboardPr[] }>("/api/recent", { pr }),
    onSuccess: (data, pr) => {
      qc.setQueryData(["recent", pr.owner, pr.repo], data);
    },
  });
  const { mutate } = mutation;
  return useCallback((pr: DashboardPr) => mutate(pr), [mutate]);
}
