/** TanStack hooks for the self-updater: poll the version status and apply an update. */

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { UpdateResult, VersionStatus } from "@/domain/system/version";

const THIRTY_MIN = 30 * 60 * 1000;

export const DISMISSED_UPDATE_KEY = "rev-dismissed-update";

export function useVersionCheck() {
  return useQuery<VersionStatus>({
    queryKey: ["version"],
    queryFn: () => api.get<VersionStatus>("/api/version"),
    refetchInterval: THIRTY_MIN,
    refetchOnWindowFocus: false,
    staleTime: THIRTY_MIN / 3,
    retry: false,
  });
}

export function useApplyUpdate() {
  return useMutation<UpdateResult, Error, void>({
    mutationFn: () => api.post<UpdateResult>("/api/update", {}),
  });
}
