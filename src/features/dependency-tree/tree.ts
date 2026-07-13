/**
 * Pure helpers for the dependency tree: grouping a PR's changed files into a
 * compacted folder hierarchy, and summarizing which of a file's imports the diff
 * actually references versus what is hidden (external or untouched).
 */

import type { FileChange } from "@/domain/pull-request/models";
import type { GraphEdge } from "@/domain/dependency-graph/build-graph";

export interface DirNode {
  name: string;
  path: string;
  dirs: DirNode[];
  files: FileChange[];
}

export interface UsedSymbol {
  sym: string;
  source: string;
}

export interface FileImportsView {
  used: UsedSymbol[];
  hidden: string[];
}

export const STATUS_COLOR: Record<string, string> = {
  added: "text-emerald-400",
  removed: "text-red-400",
  modified: "text-amber-400",
  renamed: "text-sky-400",
};

export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function indentStyle(depth: number): { paddingLeft: number } {
  return { paddingLeft: 8 + depth * 14 };
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

function byBasename(a: FileChange, b: FileChange): number {
  return basename(a.path).localeCompare(basename(b.path));
}

function compact(node: DirNode): DirNode {
  let n = node;
  while (n.name && n.files.length === 0 && n.dirs.length === 1) {
    const child = n.dirs[0];
    n = {
      name: `${n.name}/${child.name}`,
      path: child.path,
      dirs: child.dirs,
      files: child.files,
    };
  }
  n.dirs = n.dirs.map(compact).sort(byName);
  n.files.sort(byBasename);
  return n;
}

export function buildFolderTree(files: FileChange[]): DirNode {
  const root: DirNode = { name: "", path: "", dirs: [], files: [] };
  for (const file of files) {
    const parts = file.path.split("/");
    parts.pop();
    let node = root;
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      let child = node.dirs.find((d) => d.name === part);
      if (!child) {
        child = { name: part, path: acc, dirs: [], files: [] };
        node.dirs.push(child);
      }
      node = child;
    }
    node.files.push(file);
  }
  root.dirs = root.dirs.map(compact).sort(byName);
  root.files.sort(byBasename);
  return root;
}

export function countFiles(node: DirNode): number {
  return node.files.length + node.dirs.reduce((sum, d) => sum + countFiles(d), 0);
}

export function collectDirPaths(node: DirNode): string[] {
  const paths: string[] = [];
  for (const dir of node.dirs) {
    paths.push(dir.path);
    paths.push(...collectDirPaths(dir));
  }
  return paths;
}

export function fileImportsView(
  edges: GraphEdge[],
  external: string[],
): FileImportsView {
  const used = edges.flatMap((e) =>
    e.usedSymbols.map((sym) => ({ sym, source: e.to })),
  );
  const hidden = [
    ...edges
      .filter((e) => e.usedSymbols.length === 0)
      .map((e) => `${e.to} (imported, not in diff)`),
    ...external,
  ];
  return { used, hidden };
}
