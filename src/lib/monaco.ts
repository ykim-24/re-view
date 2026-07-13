/**
 * Disables Monaco's built-in TS/JS go-to-definition and reference peek so our
 * own right-side drawer is the only code-navigation affordance. Safe to call on
 * every editor mount; it only toggles the shared language-mode configuration.
 */

import type { Monaco } from "@monaco-editor/react";

export function disableBuiltInCodeNav(monaco: Monaco): void {
  const ts = monaco.languages.typescript;
  if (!ts) return;
  for (const defaults of [ts.typescriptDefaults, ts.javascriptDefaults]) {
    defaults.setModeConfiguration({
      ...defaults.modeConfiguration,
      definitions: false,
      references: false,
    });
  }
}
