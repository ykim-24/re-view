/**
 * Pure helpers for gathering code context before an AI call: pulling candidate
 * identifiers out of a snippet, counting how often a symbol appears across the
 * gathered corpus, and windowing an oversized file down to the interesting part.
 * Shared by the insight pipeline and the chat agent's tools.
 */

const MAX_FILE_CHARS = 20000;

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "import", "export", "from", "type", "interface", "class", "new", "await",
  "async", "this", "true", "false", "null", "undefined", "void", "string",
  "number", "boolean", "extends", "implements", "readonly", "static", "default",
  "switch", "case", "break", "continue", "throw", "try", "catch", "finally",
  "typeof", "instanceof", "enum", "namespace", "super", "yield", "delete",
]);

export function extractIdentifiers(text: string): string[] {
  const matches = text.match(/[A-Za-z_$][\w$]*/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (m.length < 3 || KEYWORDS.has(m) || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countOccurrences(name: string, sources: string[]): number {
  const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
  let total = 0;
  for (const src of sources) total += (src.match(re) ?? []).length;
  return total;
}

export function windowFile(
  content: string,
  startLine: number,
  endLine: number,
): string {
  if (content.length <= MAX_FILE_CHARS) return content;
  const lines = content.split("\n");
  const head = lines.slice(0, 50);
  const from = Math.max(50, startLine - 1 - 100);
  const to = Math.min(lines.length, endLine + 100);
  return `${head.join("\n")}\n…\n${lines.slice(from, to).join("\n")}`;
}

/** Every name bound by an `import` statement in the file. */
export function importedNames(content: string): Set<string> {
  const names = new Set<string>();
  const statements = content.match(/import\s[\s\S]*?from\s*['"][^'"]+['"]/g) ?? [];
  for (const statement of statements) {
    const clause = statement.slice(0, statement.lastIndexOf("from"));
    for (const name of clause.match(/[A-Za-z_$][\w$]*/g) ?? []) {
      if (name === "import" || name === "type" || name === "as") continue;
      names.add(name);
    }
  }
  return names;
}

/**
 * Candidate identifiers from a snippet, with the ones the file imports first.
 * Without this bias a JSX-heavy selection spends its whole resolution budget on
 * Tailwind class fragments before reaching the symbols that actually cross files.
 */
export function rankedIdentifiers(snippet: string, fileContent: string): string[] {
  const imported = importedNames(fileContent);
  const identifiers = extractIdentifiers(snippet);
  return [
    ...identifiers.filter((name) => imported.has(name)),
    ...identifiers.filter((name) => !imported.has(name)),
  ];
}

/** Slice out a 1-based, inclusive line range, clamped to the file. */
export function sliceLines(
  content: string,
  startLine: number,
  endLine: number,
): string {
  const lines = content.split("\n");
  const from = Math.max(0, startLine - 1);
  const to = Math.min(lines.length, endLine);
  return lines.slice(from, to).join("\n");
}
