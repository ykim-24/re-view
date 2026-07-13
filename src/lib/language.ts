/** Map a file path to a Monaco language id. Best-effort by extension. */
const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  md: "markdown",
  mdx: "markdown",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  rb: "ruby",
  php: "php",
  sh: "shell",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
};

export function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? "plaintext";
}

/** Whether we can parse imports / do go-to-definition for this file (TS/JS only). */
export function isCodeIntelPath(path: string): boolean {
  const lang = languageForPath(path);
  return lang === "typescript" || lang === "javascript";
}
