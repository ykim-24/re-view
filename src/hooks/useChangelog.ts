import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

/** The repo's CHANGELOG.md markdown, shown in the changelog modal. */
export function useChangelog() {
  return useQuery<{ content: string }>({
    queryKey: ["changelog"],
    queryFn: () => api.get<{ content: string }>("/api/changelog"),
    staleTime: 1000 * 60 * 5,
  });
}
