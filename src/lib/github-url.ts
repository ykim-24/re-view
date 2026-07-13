export interface PrRef {
  owner: string;
  repo: string;
  number: number;
}

/**
 * Accepts either a full GitHub PR URL or the shorthand "owner/repo#123" /
 * "owner/repo/123" and returns a structured ref. Returns null if it can't parse.
 */
export function parsePrInput(input: string): PrRef | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i,
  );
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2], number: Number(urlMatch[3]) };
  }

  const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s#]+)[#/](\d+)$/);
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      number: Number(shortMatch[3]),
    };
  }

  return null;
}

export interface RepoRef {
  owner: string;
  repo: string;
}

/**
 * Parse a repo from a URL (https://github.com/owner/repo[/...]) or the shorthand
 * "owner/repo". Returns null if it can't parse.
 */
export function parseRepoInput(input: string): RepoRef | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, "") };
  }

  const shortMatch = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/, "") };
  }

  return null;
}
