import "server-only";
import { github } from "./client";
import type {
  BranchList,
  CompareData,
  CompareStatus,
} from "@/domain/branch/models";
import type { FileChange, FileStatus } from "@/domain/pull-request/models";

/** All branches in a repo (default branch first), plus the default branch name. */
export async function listBranches(
  owner: string,
  repo: string,
): Promise<BranchList> {
  const gh = github();

  const [{ data: repoData }, branches] = await Promise.all([
    gh.repos.get({ owner, repo }),
    gh.paginate(gh.repos.listBranches, { owner, repo, per_page: 100 }),
  ]);

  const defaultBranch = repoData.default_branch;
  const summaries = branches.map((b) => ({
    name: b.name,
    sha: b.commit.sha,
    isDefault: b.name === defaultBranch,
    protected: Boolean(b.protected),
  }));

  summaries.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { branches: summaries, defaultBranch };
}

/**
 * Compare two refs the way GitHub does — against their merge-base, so the diff
 * matches a PR of head into base. `base`/`head` may be branch names or SHAs.
 */
export async function compareRefs(
  owner: string,
  repo: string,
  base: string,
  head: string,
): Promise<CompareData> {
  const gh = github();

  // No per_page: an unpaginated compare returns up to 250 commits and 300 files.
  // Paginating it truncates both, which would leave the head sha and file list
  // stale. Resolve the head sha directly so content is always fetched at the tip.
  const [{ data }, { data: headCommit }] = await Promise.all([
    gh.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${base}...${head}`,
    }),
    gh.repos.getCommit({ owner, repo, ref: head }),
  ]);

  const files: FileChange[] = (data.files ?? []).map((f) => ({
    path: f.filename,
    previousPath: f.previous_filename,
    status: f.status as FileStatus,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));

  const mergeBaseSha = data.merge_base_commit?.sha ?? data.base_commit.sha;

  return {
    base: { ref: base, sha: mergeBaseSha },
    head: { ref: head, sha: headCommit.sha },
    mergeBaseSha,
    status: data.status as CompareStatus,
    aheadBy: data.ahead_by,
    behindBy: data.behind_by,
    files,
  };
}
