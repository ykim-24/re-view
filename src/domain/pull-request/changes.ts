/**
 * Parses a unified-diff patch into change groups: each maximal run of
 * consecutive added (+) or removed (-) lines becomes one group, tagged with the
 * line it starts at (head line for added, base line for removed) so the UI can
 * list a file's changes and scroll the diff to each one.
 */

export interface ChangeGroup {
  type: "added" | "removed";
  side: "head" | "base";
  startLine: number;
  lineCount: number;
  preview: string;
}

const HUNK_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Head-file line numbers GitHub will accept an inline review comment on: the
 * added (+) and context ( ) lines inside each hunk. Lines outside any hunk, and
 * removed lines, are not commentable on the head side.
 */
export function commentableHeadLines(patch: string | undefined): Set<number> {
  const lines = new Set<number>();
  if (!patch) return lines;

  let newLine = 0;
  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      const m = raw.match(HUNK_RE);
      if (m) newLine = Number(m[2]);
      continue;
    }
    if (raw.startsWith("\\")) continue;
    // '-' is base-only; everything else ('+', ' ', or a blank context line that
    // git emits with no leading space) is a head line and commentable.
    if (raw.startsWith("-")) continue;
    lines.add(newLine);
    newLine++;
  }
  return lines;
}

export function parsePatchChanges(patch: string | undefined): ChangeGroup[] {
  if (!patch) return [];

  const groups: ChangeGroup[] = [];
  let oldLine = 0;
  let newLine = 0;
  let current: ChangeGroup | null = null;

  const flush = () => {
    if (current) {
      groups.push(current);
      current = null;
    }
  };

  for (const raw of patch.split("\n")) {
    if (raw.startsWith("@@")) {
      flush();
      const m = raw.match(HUNK_RE);
      if (m) {
        oldLine = Number(m[1]);
        newLine = Number(m[2]);
      }
      continue;
    }
    if (raw.startsWith("\\")) continue;

    const marker = raw[0];
    const text = raw.slice(1);

    if (marker === "+") {
      if (!current || current.type !== "added") {
        flush();
        current = {
          type: "added",
          side: "head",
          startLine: newLine,
          lineCount: 0,
          preview: text.trim(),
        };
      }
      current.lineCount++;
      newLine++;
    } else if (marker === "-") {
      if (!current || current.type !== "removed") {
        flush();
        current = {
          type: "removed",
          side: "base",
          startLine: oldLine,
          lineCount: 0,
          preview: text.trim(),
        };
      }
      current.lineCount++;
      oldLine++;
    } else {
      flush();
      oldLine++;
      newLine++;
    }
  }

  flush();
  return groups;
}
