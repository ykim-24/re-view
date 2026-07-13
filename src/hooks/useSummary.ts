import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { summaryKey, type SummaryTarget } from "@/lib/pr-key";

/** A saved summary as returned by the API (camelCase mirror of the DB row). */
export interface SavedSummary {
  key: string;
  kind: "pr" | "compare";
  owner: string;
  repo: string;
  headSha: string;
  content: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

function targetParams(target: SummaryTarget): string {
  const p = new URLSearchParams({
    kind: target.kind,
    owner: target.owner,
    repo: target.repo,
  });
  if (target.kind === "pr") p.set("number", String(target.number));
  else {
    p.set("base", target.base);
    p.set("head", target.head);
  }
  return p.toString();
}

/** The saved summary for a target, or null if none has been generated yet. */
export function useSummary(target: SummaryTarget | null) {
  return useQuery<SavedSummary | null>({
    queryKey: ["summary", target ? summaryKey(target) : "none"],
    enabled: Boolean(target),
    queryFn: () => api.get<SavedSummary | null>(`/api/summary?${targetParams(target!)}`),
  });
}
