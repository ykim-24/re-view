/**
 * Heuristic TS/JS import extraction. Not a full parser — regex over source text —
 * but robust enough to map what a file imports and under which local names, which
 * is all the dependency graph and go-to-definition need. For each binding,
 * `imported` is the name as exported by the source module: a name, "default", or "*".
 */

export interface ImportBinding {
  local: string;
  imported: string;
}

export interface ParsedImport {
  source: string;
  bindings: ImportBinding[];
  line: number;
}

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

function parseClause(clause: string): ImportBinding[] {
  const bindings: ImportBinding[] = [];
  const trimmed = clause.trim().replace(/^type\s+/, "");
  if (!trimmed) return bindings;

  const nsMatch = trimmed.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
  if (nsMatch) bindings.push({ local: nsMatch[1], imported: "*" });

  const namedMatch = trimmed.match(/\{([\s\S]*?)\}/);
  if (namedMatch) {
    for (const raw of namedMatch[1].split(",")) {
      const part = raw.trim().replace(/^type\s+/, "");
      if (!part) continue;
      const asMatch = part.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (asMatch) bindings.push({ local: asMatch[2], imported: asMatch[1] });
      else if (/^[A-Za-z_$][\w$]*$/.test(part))
        bindings.push({ local: part, imported: part });
    }
  }

  const defaultMatch = trimmed.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
  if (defaultMatch && !nsMatch) {
    bindings.push({ local: defaultMatch[1], imported: "default" });
  }

  return bindings;
}

const IMPORT_FROM_RE =
  /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_RE = /import\s+['"]([^'"]+)['"]/g;
const EXPORT_FROM_RE =
  /export\s+(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]/g;
const REQUIRE_RE = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_RE = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

export function parseImports(source: string): ParsedImport[] {
  const results: ParsedImport[] = [];
  let m: RegExpExecArray | null;

  IMPORT_FROM_RE.lastIndex = 0;
  while ((m = IMPORT_FROM_RE.exec(source)) !== null) {
    results.push({
      source: m[2],
      bindings: parseClause(m[1]),
      line: lineAt(source, m.index),
    });
  }

  for (const re of [SIDE_EFFECT_RE, EXPORT_FROM_RE, REQUIRE_RE, DYNAMIC_RE]) {
    re.lastIndex = 0;
    while ((m = re.exec(source)) !== null) {
      results.push({ source: m[1], bindings: [], line: lineAt(source, m.index) });
    }
  }

  return dedupeBySourceLine(results);
}

function dedupeBySourceLine(imports: ParsedImport[]): ParsedImport[] {
  const seen = new Set<string>();
  const out: ParsedImport[] = [];
  for (const imp of imports) {
    const key = `${imp.line}:${imp.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(imp);
  }
  return out.sort((a, b) => a.line - b.line);
}

export function findBindingForName(
  imports: ParsedImport[],
  localName: string,
): { source: string; binding: ImportBinding } | null {
  for (const imp of imports) {
    const binding = imp.bindings.find((b) => b.local === localName);
    if (binding) return { source: imp.source, binding };
  }
  return null;
}
