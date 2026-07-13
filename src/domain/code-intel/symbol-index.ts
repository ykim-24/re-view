/**
 * Heuristic symbol indexer: finds top-level declarations and their 1-based line
 * numbers so go-to-definition can jump to where a symbol is defined. Regex-based,
 * TS/JS. `findDefinition` prefers an exported declaration, then the first match;
 * pass "default" to locate the default export. `definitionEndLine` brace-matches
 * from a declaration to estimate the last line of its block (the whole function,
 * class or type), falling back to the statement's terminating line.
 */

export interface SymbolLocation {
  name: string;
  line: number;
  exported: boolean;
  kind:
    | "function"
    | "const"
    | "class"
    | "type"
    | "interface"
    | "enum"
    | "namespace"
    | "default";
}

interface Pattern {
  re: RegExp;
  kind: SymbolLocation["kind"];
}

/**
 * Single-name declaration forms, tried in order (the first hit wins per line).
 * Each tolerates a leading `export`, `export default` and/or `declare`. Variable
 * declarations are handled separately so multi-declarator lines yield every name.
 */
const PATTERNS: Pattern[] = [
  { re: /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, kind: "function" },
  { re: /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?abstract\s+class\s+([A-Za-z_$][\w$]*)/, kind: "class" },
  { re: /^\s*(?:export\s+)?(?:default\s+)?(?:declare\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: "class" },
  { re: /^\s*(?:export\s+)?(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)/, kind: "interface" },
  { re: /^\s*(?:export\s+)?(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)/, kind: "type" },
  { re: /^\s*(?:export\s+)?(?:declare\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/, kind: "enum" },
  { re: /^\s*(?:export\s+)?(?:declare\s+)?(?:namespace|module)\s+([A-Za-z_$][\w$.]*)/, kind: "namespace" },
];

const VAR_DECL = /^\s*(?:export\s+)?(?:declare\s+)?(?:const|let|var)\s+(?!enum\b)(.+)$/;
const COMMONJS = /^\s*(?:module\.)?exports\.([A-Za-z_$][\w$]*)\s*=/;
const STAR_AS = /^\s*export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\b/;
const EXPORT_LIST = /^\s*export\s+(?:type\s+)?\{([^}]*)\}/;

/**
 * Split a `const`/`let`/`var` declarator list on top-level commas and take the
 * leading identifier of each (so `const a = 1, b = 2` yields both). Destructuring
 * patterns (`const { a } = …`) have no leading identifier and are skipped.
 */
function declaratorNames(decl: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < decl.length; i++) {
    const ch = decl[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      segments.push(decl.slice(start, i));
      start = i + 1;
    }
  }
  segments.push(decl.slice(start));

  const names: string[] = [];
  for (const seg of segments) {
    const m = seg.trim().match(/^([A-Za-z_$][\w$]*)/);
    if (m) names.push(m[1]);
  }
  return names;
}

function isExportLine(text: string): boolean {
  return (
    /^\s*export\b/.test(text) ||
    /^\s*(?:export\s+)?declare\b/.test(text) ||
    /^\s*(?:module\.)?exports\./.test(text)
  );
}

export function indexSymbols(source: string): SymbolLocation[] {
  const lines = source.split("\n");
  const out: SymbolLocation[] = [];

  lines.forEach((text, i) => {
    const line = i + 1;
    const exported = isExportLine(text);

    const cjs = text.match(COMMONJS);
    if (cjs) {
      out.push({ name: cjs[1], line, exported: true, kind: "const" });
      return;
    }

    const starAs = text.match(STAR_AS);
    if (starAs) {
      out.push({ name: starAs[1], line, exported: true, kind: "namespace" });
      return;
    }

    const list = text.match(EXPORT_LIST);
    if (list) {
      for (const raw of list[1].split(",")) {
        const part = raw.trim().replace(/^type\s+/, "");
        if (!part) continue;
        const asMatch = part.match(/\bas\s+([A-Za-z_$][\w$]*)$/);
        const name = asMatch ? asMatch[1] : part;
        if (/^[A-Za-z_$][\w$]*$/.test(name))
          out.push({ name, line, exported: true, kind: "const" });
      }
      return;
    }

    const varDecl = text.match(VAR_DECL);
    if (varDecl) {
      for (const name of declaratorNames(varDecl[1]))
        out.push({ name, line, exported, kind: "const" });
      return;
    }

    for (const { re, kind } of PATTERNS) {
      const m = text.match(re);
      if (m) {
        out.push({ name: m[1], line, exported, kind });
        break;
      }
    }

    if (/^\s*export\s+default\b/.test(text)) {
      out.push({ name: "default", line, exported: true, kind: "default" });
    }
  });

  return out;
}

export function findDefinition(
  symbols: SymbolLocation[],
  name: string,
): SymbolLocation | null {
  const matches = symbols.filter((s) => s.name === name);
  if (matches.length === 0) return null;
  return matches.find((s) => s.exported) ?? matches[0];
}

function stripStringsAndLineComment(line: string): string {
  let out = "";
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "/" && line[i + 1] === "/") break;
    out += ch;
  }
  return out;
}

export function definitionEndLine(source: string, startLine: number): number {
  const lines = source.split("\n");
  if (startLine < 1 || startLine > lines.length) return startLine;

  let depth = 0;
  let seenBrace = false;
  const limit = Math.min(lines.length, startLine + 500);

  for (let i = startLine - 1; i < limit; i++) {
    const code = stripStringsAndLineComment(lines[i]);
    for (const ch of code) {
      if (ch === "{") {
        depth++;
        seenBrace = true;
      } else if (ch === "}") {
        depth = Math.max(0, depth - 1);
      }
    }
    if (seenBrace && depth === 0) return i + 1;
    if (!seenBrace && /;\s*$/.test(code)) return i + 1;
  }

  return startLine;
}
