/**
 * Minimal POSIX-style path helpers. We avoid node:path so this module stays pure
 * and usable in any runtime. Paths here are always repo-relative, forward-slash.
 * `joinAndNormalize` resolves a relative specifier against a base dir, collapsing
 * "." and "..".
 */

export function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "" : path.slice(0, idx);
}

export function joinAndNormalize(baseDir: string, relative: string): string {
  const segments = baseDir
    ? baseDir.split("/").filter((s) => s && s !== ".")
    : [];
  for (const part of relative.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return segments.join("/");
}

export function extname(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot);
}
