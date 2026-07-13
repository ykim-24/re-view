import "server-only";

/**
 * GitHub reads for building the repo symbol index: the default branch's head
 * (the save point), the recursive file tree with per-blob shas (so we can detect
 * exactly which files changed between commits), and raw blob text to parse.
 */

import { github } from "./client";

export interface DefaultBranchHead {
  branch: string;
  commitSha: string;
  treeSha: string;
}

export interface TreeEntry {
  path: string;
  blobSha: string;
}

export interface RepoTree {
  entries: TreeEntry[];
  truncated: boolean;
}

export async function getDefaultBranchHead(
  owner: string,
  repo: string,
): Promise<DefaultBranchHead> {
  const gh = github();
  const { data: repoData } = await gh.repos.get({ owner, repo });
  const branch = repoData.default_branch;
  const { data: branchData } = await gh.repos.getBranch({ owner, repo, branch });
  return {
    branch,
    commitSha: branchData.commit.sha,
    treeSha: branchData.commit.commit.tree.sha,
  };
}

export async function listRepoTree(
  owner: string,
  repo: string,
  treeSha: string,
): Promise<RepoTree> {
  const gh = github();
  const { data } = await gh.git.getTree({
    owner,
    repo,
    tree_sha: treeSha,
    recursive: "true",
  });
  const entries: TreeEntry[] = [];
  for (const node of data.tree) {
    if (node.type === "blob" && node.path && node.sha) {
      entries.push({ path: node.path, blobSha: node.sha });
    }
  }
  return { entries, truncated: data.truncated === true };
}

export async function getBlobText(
  owner: string,
  repo: string,
  blobSha: string,
): Promise<string | null> {
  const gh = github();
  const { data } = await gh.git.getBlob({ owner, repo, file_sha: blobSha });
  if (typeof data.content !== "string") return null;
  return Buffer.from(data.content, "base64").toString("utf8");
}

export async function downloadRepoTarball(
  owner: string,
  repo: string,
  ref: string,
): Promise<Buffer> {
  const gh = github();
  const res = await gh.repos.downloadTarballArchive({ owner, repo, ref });
  return Buffer.from(res.data as ArrayBuffer);
}
