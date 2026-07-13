/** Helpers for reasoning about a unified-diff patch (from the GitHub API). */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Text of the lines the PR actually changed (added + removed), with the
 * leading +/- stripped and the @@ hunk headers and file headers excluded.
 */
export function changedLineText(patch: string | undefined): string {
  if (!patch) return "";
  return patch
    .split("\n")
    .filter(
      (l) =>
        (l.startsWith("+") || l.startsWith("-")) &&
        !l.startsWith("+++") &&
        !l.startsWith("---"),
    )
    .map((l) => l.slice(1))
    .join("\n");
}

/**
 * Of `symbols`, the ones referenced (as whole words) in the patch's changed
 * lines — i.e. the imported names this PR actually touches.
 */
export function symbolsUsedInPatch(
  patch: string | undefined,
  symbols: string[],
): string[] {
  const text = changedLineText(patch);
  if (!text) return [];
  return symbols.filter(
    (s) => s && new RegExp(`\\b${escapeRegExp(s)}\\b`).test(text),
  );
}
