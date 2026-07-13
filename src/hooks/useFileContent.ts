import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";

export interface FileContentResponse {
  path: string;
  ref: string;
  content: string | null;
  exists: boolean;
}

export function fileKey(owner: string, repo: string, path: string, ref: string) {
  return ["file", owner, repo, path, ref] as const;
}

/** Fetch a file's content at a ref. `enabled` lets callers gate fetching. */
export function useFileContent(
  owner: string,
  repo: string,
  path: string | null,
  ref: string | null,
  enabled = true,
) {
  return useQuery<FileContentResponse>({
    queryKey: fileKey(owner, repo, path ?? "", ref ?? ""),
    enabled: enabled && Boolean(path) && Boolean(ref),
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    queryFn: () =>
      api.get<FileContentResponse>(
        `/api/file?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(
          repo,
        )}&path=${encodeURIComponent(path!)}&ref=${encodeURIComponent(ref!)}`,
      ),
  });
}
