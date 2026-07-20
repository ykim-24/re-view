/**
 * Teaches Monaco the runtime surface a component's code runs against — `ctx`,
 * `secrets`, `log`, `fetch`, and a `components.<key>` handle per sibling — so the
 * editor autocompletes them as you type. Declarations are injected as an ambient
 * lib (replaced in place on key changes); diagnostics are off since the code is
 * an implicit async body (top-level await/return are expected).
 */

import type { Monaco } from "@monaco-editor/react";

const LIB_PATH = "file:///flow-globals.d.ts";

function buildDeclarations(componentKeys: string[]): string {
  const entries = componentKeys
    .map((key) => `    ${key}: { output: any; run(): Promise<any> };`)
    .join("\n");
  return [
    "declare const ctx: Record<string, any>;",
    "declare const secrets: { get(name: string): string; names(): string[] };",
    "declare function fetch(input: any, init?: any): Promise<Response>;",
    "interface FlowLog { (...args: any[]): void; debug(...args: any[]): void; error(...args: any[]): void; }",
    "declare const log: FlowLog;",
    `declare const components: {\n${entries}\n};`,
  ].join("\n");
}

export function applyFlowGlobals(monaco: Monaco, componentKeys: string[]): void {
  const ts = monaco.languages.typescript;
  if (!ts) return;
  const defaults = ts.javascriptDefaults;
  defaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
  defaults.addExtraLib(buildDeclarations(componentKeys), LIB_PATH);
}
