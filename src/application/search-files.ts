import "server-only";
import { getFileContent } from "@/infrastructure/github/pull-request.repository";

export interface SearchMatch {
  path: string;
  line: number;
  preview: string;
}

export interface SearchFilesInput {
  owner: string;
  repo: string;
  ref: string;
  paths: string[];
  query: string;
}

const MAX_MATCHES = 200;
const MAX_PER_FILE = 50;

/**
 * Plain case-insensitive substring search across the head content of the given
 * files. Bounded so a broad query stays responsive.
 */
export async function searchFiles(input: SearchFilesInput): Promise<SearchMatch[]> {
  const { owner, repo, ref, paths, query } = input;
  const needle = query.toLowerCase();
  if (!needle) return [];

  const perFile = await Promise.all(
    paths.map(async (path) => {
      const content = await getFileContent(owner, repo, path, ref);
      if (content === null) return [];
      const matches: SearchMatch[] = [];
      const lines = content.split("\n");
      for (let i = 0; i < lines.length && matches.length < MAX_PER_FILE; i++) {
        if (lines[i].toLowerCase().includes(needle)) {
          matches.push({ path, line: i + 1, preview: lines[i].trim().slice(0, 200) });
        }
      }
      return matches;
    }),
  );

  return perFile.flat().slice(0, MAX_MATCHES);
}
