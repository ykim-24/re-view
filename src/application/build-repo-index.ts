import "server-only";

/**
 * Builds and refreshes the repo-wide symbol index. The save point is the default
 * branch's head commit: if the stored index already matches it, nothing happens;
 * if the head moved, only files whose blob sha changed are re-scanned; otherwise
 * a full build runs. Builds are kicked in the background (fire-and-forget) and
 * de-duplicated per repo via an in-process guard.
 */

import { repoKey as makeRepoKey } from "@/lib/pr-key";
import {
  downloadRepoTarball,
  getDefaultBranchHead,
  getBlobText,
  listRepoTree,
  type DefaultBranchHead,
} from "@/infrastructure/github/code-index.repository";
import { extractTarGz } from "@/infrastructure/archive/untar";
import {
  applyDelta,
  getIndexedFileShas,
  getRepoIndexMeta,
  markError,
  replaceIndex,
  setBuilding,
  type FileSymbols,
  type RepoIndexMeta,
  type SymbolRow,
} from "@/infrastructure/db/code-index.repository";
import { isIndexablePath } from "@/domain/code-intel/indexable";
import {
  definitionEndLine,
  indexSymbols,
} from "@/domain/code-intel/symbol-index";

const CONCURRENCY = 12;
const BLOB_ATTEMPTS = 3;
const LARGE_DELTA = 400;

const inFlight = new Map<string, Promise<void>>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBlobWithRetry(
  owner: string,
  repo: string,
  blobSha: string,
): Promise<string | null> {
  for (let attempt = 1; attempt <= BLOB_ATTEMPTS; attempt++) {
    try {
      return await getBlobText(owner, repo, blobSha);
    } catch {
      if (attempt === BLOB_ATTEMPTS) return null;
      await delay(200 * attempt);
    }
  }
  return null;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      results[i] = await fn(items[i]);
    }
  };
  const count = Math.min(limit, items.length);
  const workers: Promise<void>[] = [];
  for (let i = 0; i < count; i += 1) workers.push(worker());
  await Promise.all(workers);
  return results;
}

function scanFile(path: string, blobSha: string, source: string): FileSymbols {
  const symbols: SymbolRow[] = indexSymbols(source)
    .filter((s) => s.exported)
    .map((s) => ({
      name: s.name,
      kind: s.kind,
      path,
      line: s.line,
      endLine: definitionEndLine(source, s.line),
      exported: s.exported,
    }));
  return { path, blobSha, symbols };
}

async function scanEntries(
  owner: string,
  repo: string,
  entries: { path: string; blobSha: string }[],
): Promise<FileSymbols[]> {
  const scanned = await mapPool(entries, CONCURRENCY, async (e) => {
    const text = await fetchBlobWithRetry(owner, repo, e.blobSha);
    if (text === null) return null;
    return scanFile(e.path, e.blobSha, text);
  });
  return scanned.filter((f): f is FileSymbols => f !== null);
}

function stripTopDir(path: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

async function buildFull(
  owner: string,
  repo: string,
  key: string,
  head: DefaultBranchHead,
): Promise<void> {
  const [archive, tree] = await Promise.all([
    downloadRepoTarball(owner, repo, head.commitSha),
    listRepoTree(owner, repo, head.treeSha),
  ]);
  const shaByPath = new Map(tree.entries.map((e) => [e.path, e.blobSha]));

  const files: FileSymbols[] = [];
  for (const entry of extractTarGz(archive)) {
    const path = stripTopDir(entry.path);
    if (!isIndexablePath(path)) continue;
    const source = entry.data.toString("utf8");
    files.push(scanFile(path, shaByPath.get(path) ?? "", source));
  }
  replaceIndex(key, head.commitSha, files);
}

async function buildIncremental(
  owner: string,
  repo: string,
  key: string,
  head: DefaultBranchHead,
  prevShas: Map<string, string>,
): Promise<void> {
  const { entries } = await listRepoTree(owner, repo, head.treeSha);
  const code = entries.filter((e) => isIndexablePath(e.path));
  const currentPaths = new Set(code.map((e) => e.path));
  const changed = code.filter((e) => prevShas.get(e.path) !== e.blobSha);
  const removed = [...prevShas.keys()].filter((p) => !currentPaths.has(p));

  if (changed.length > LARGE_DELTA) {
    await buildFull(owner, repo, key, head);
    return;
  }

  const scanned = await scanEntries(owner, repo, changed);
  applyDelta(key, head.commitSha, scanned, removed);
}

function buildingMeta(key: string, headSha: string): RepoIndexMeta {
  return {
    repoKey: key,
    headSha,
    status: "building",
    fileCount: 0,
    symbolCount: 0,
    message: null,
    indexedAt: new Date().toISOString(),
  };
}

export async function ensureRepoIndex(
  owner: string,
  repo: string,
): Promise<RepoIndexMeta> {
  const key = makeRepoKey({ owner, repo });

  if (inFlight.has(key)) {
    return getRepoIndexMeta(key) ?? buildingMeta(key, "");
  }

  const meta = getRepoIndexMeta(key);
  const head = await getDefaultBranchHead(owner, repo);

  if (meta && meta.status === "ready" && meta.headSha === head.commitSha) {
    return meta;
  }

  const prevShas =
    meta && meta.status === "ready" ? getIndexedFileShas(key) : null;
  setBuilding(key, head.commitSha);

  const run =
    prevShas && prevShas.size > 0
      ? buildIncremental(owner, repo, key, head, prevShas)
      : buildFull(owner, repo, key, head);

  const task = run
    .catch((err: unknown) => {
      markError(
        key,
        head.commitSha,
        err instanceof Error ? err.message : "Index build failed",
      );
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  return getRepoIndexMeta(key) ?? buildingMeta(key, head.commitSha);
}
