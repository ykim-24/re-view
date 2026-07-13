import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { DashboardPr } from "@/domain/pull-request/models";

export function useReviewRequested() {
  return useQuery<{ prs: DashboardPr[] }>({
    queryKey: ["review-requested"],
    queryFn: () => api.get<{ prs: DashboardPr[] }>("/api/review-requested"),
  });
}
