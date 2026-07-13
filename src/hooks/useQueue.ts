import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { DashboardPr, QueueData } from "@/domain/pull-request/models";

const QUEUE_KEY = ["queue"] as const;

export function useQueue() {
  return useQuery<QueueData>({
    queryKey: QUEUE_KEY,
    queryFn: () => api.get<QueueData>("/api/queue"),
  });
}

type QueuePayload =
  | { action: "add" | "finish"; pr: DashboardPr }
  | { action: "remove" | "unfinish"; key: string };

function useQueueMutation() {
  const qc = useQueryClient();
  return useMutation<QueueData, Error, QueuePayload>({
    mutationFn: (payload) => api.post<QueueData>("/api/queue", payload),
    onSuccess: (data) => qc.setQueryData(QUEUE_KEY, data),
  });
}

export function useQueueActions() {
  const mutation = useQueueMutation();
  const { mutate } = mutation;
  return {
    addToReview: (pr: DashboardPr) => mutate({ action: "add", pr }),
    removeFromReview: (key: string) => mutate({ action: "remove", key }),
    markFinished: (pr: DashboardPr) => mutate({ action: "finish", pr }),
    unmarkFinished: (key: string) => mutate({ action: "unfinish", key }),
  };
}
