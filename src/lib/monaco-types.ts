/**
 * Wires intra-repo type information into Monaco so hovers resolve real types
 * instead of `any`. Sets TS compiler options from the repo's tsconfig and loads
 * each imported file as a model at its real path so the worker can resolve them.
 * All operations are guarded — failures degrade to plain (untyped) hovers.
 */

import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

export interface TypeContext {
  baseUrl: string;
  paths: Record<string, string[]>;
  libs: { path: string; content: string }[];
}

const loadedModels = new Set<string>();
let optionsApplied = false;

function fileUri(monaco: Monaco, repoPath: string) {
  return monaco.Uri.parse(`file:///${repoPath.replace(/^\/+/, "")}`);
}

function applyCompilerOptions(monaco: Monaco, ctx: TypeContext) {
  const ts = monaco.languages.typescript;
  if (!ts) return;
  const baseUrl = `file:///${ctx.baseUrl === "." ? "" : ctx.baseUrl}`;
  const options = {
    allowJs: true,
    checkJs: false,
    allowNonTsExtensions: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler ?? ts.ModuleResolutionKind.NodeJs,
    baseUrl,
    paths: ctx.paths,
    noEmit: true,
    skipLibCheck: true,
  };
  ts.typescriptDefaults.setCompilerOptions(options);
  ts.javascriptDefaults.setCompilerOptions(options);
  // We don't load node_modules types, so semantic errors would be noise.
  const diagnostics = { noSemanticValidation: true, noSyntaxValidation: true };
  ts.typescriptDefaults.setDiagnosticsOptions(diagnostics);
  ts.javascriptDefaults.setDiagnosticsOptions(diagnostics);
}

/** Register the file's dependency sources + tsconfig options with the TS worker. */
export function applyTypeContext(monaco: Monaco, ctx: TypeContext): void {
  try {
    if (!optionsApplied) {
      applyCompilerOptions(monaco, ctx);
      optionsApplied = true;
    }
    for (const lib of ctx.libs) {
      const uri = fileUri(monaco, lib.path);
      const key = uri.toString();
      if (loadedModels.has(key)) continue;
      if (!monaco.editor.getModel(uri)) {
        monaco.editor.createModel(lib.content, undefined, uri);
      }
      loadedModels.add(key);
    }
  } catch {
    // typings are best-effort; never break the editor
  }
}

/**
 * Give the diff's modified editor a model at the file's real repo path so its
 * imports resolve against the loaded dependency models. Returns silently on error.
 */
export function rehomeModifiedModel(
  monaco: Monaco,
  diffEditor: editor.IStandaloneDiffEditor,
  repoPath: string,
  language: string,
): void {
  try {
    const current = diffEditor.getModel();
    if (!current) return;
    const uri = fileUri(monaco, repoPath);
    const value = current.modified.getValue();
    let model = monaco.editor.getModel(uri);
    if (model) model.setValue(value);
    else model = monaco.editor.createModel(value, language, uri);
    if (model !== current.modified) {
      diffEditor.setModel({ original: current.original, modified: model });
    }
  } catch {
    // keep the default model if rehoming fails
  }
}
