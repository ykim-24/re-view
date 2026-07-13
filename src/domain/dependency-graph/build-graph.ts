/**
 * Pure assembly of the dependency graph. The impure work (fetching file
 * contents, probing which import candidate actually exists) happens in the
 * infrastructure/route layer, which feeds already-resolved dependencies here.
 */

export interface ResolvedDependency {
  /** repo-relative path of the imported file that was confirmed to exist */
  to: string;
  /** module specifier as written in the source */
  specifier: string;
  /** local binding names imported from it */
  symbols: string[];
  /** subset of `symbols` actually referenced in the PR's changed lines */
  usedSymbols: string[];
  /** true if the dependency file is itself part of the PR diff */
  changed: boolean;
}

export interface ChangedFileDeps {
  path: string;
  /** dependencies that were resolved to a real file */
  deps: ResolvedDependency[];
  /** specifiers we could not resolve (external/node_modules or missing) */
  unresolved: string[];
}

export interface GraphNode {
  id: string;
  path: string;
  /** part of the PR diff */
  changed: boolean;
  /** a resolved local dependency (not external) */
  external: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  symbols: string[];
  /** imported names referenced in the PR's changed lines */
  usedSymbols: string[];
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** per changed-file: specifiers that couldn't be resolved (for display) */
  unresolved: Record<string, string[]>;
}

export function buildGraph(files: ChangedFileDeps[]): DependencyGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const unresolved: Record<string, string[]> = {};

  const ensureNode = (path: string, changed: boolean) => {
    const existing = nodes.get(path);
    if (existing) {
      if (changed) existing.changed = true;
      return;
    }
    nodes.set(path, { id: path, path, changed, external: false });
  };

  for (const file of files) {
    ensureNode(file.path, true);
    if (file.unresolved.length > 0) unresolved[file.path] = file.unresolved;

    for (const dep of file.deps) {
      ensureNode(dep.to, dep.changed);
      edges.push({
        from: file.path,
        to: dep.to,
        symbols: dep.symbols,
        usedSymbols: dep.usedSymbols,
      });
    }
  }

  return { nodes: [...nodes.values()], edges, unresolved };
}
