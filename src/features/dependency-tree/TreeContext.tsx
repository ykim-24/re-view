"use client";

/**
 * Context shared by the dependency tree's nested rows so dirs, files and symbol
 * rows can read graph data and dispatch actions without prop-drilling.
 */

import { createContext, useContext } from "react";

export interface TreeContextValue {
  owner: string;
  repo: string;
  headRef: string;
  selectedPath: string | null;
  expandedFiles: Set<string>;
  collapsedDirs: Set<string>;
  selectFile(path: string): void;
  toggleFile(path: string): void;
  toggleDir(path: string): void;
  goToDefinition(importerPath: string, symbol: string): void;
}

const TreeContext = createContext<TreeContextValue | null>(null);

export function useTreeContext(): TreeContextValue {
  const value = useContext(TreeContext);
  if (!value) {
    throw new Error("useTreeContext must be used within TreeContext.Provider");
  }
  return value;
}

export const TreeProvider = TreeContext.Provider;
