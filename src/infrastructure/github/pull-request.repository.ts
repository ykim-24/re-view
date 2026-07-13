import "server-only";
import { github } from "./client";
import { repoKey } from "@/lib/pr-key";
import {
  getCachedFile,
  isImmutableRef,
  setCachedFile,
} from "@/infrastructure/db/file-cache.repository";
import type {
  CodeReference,
  CommitDetail,
  DashboardPr,
  FileChange,
  FileStatus,
  PrComment,
  PrCommit,
  PrComments,
  PrCommentThread,
  PrStateFilter,
  PullRequest,
  PullRequestData,
  PullRequestSummary,
  SubmitReviewInput,
} from "@/domain/pull-request/models";

/** A single commit's changes (diffed against its first parent). */
export async function getCommitDetail(
  owner: string,
  repo: string,
  sha: string,
): Promise<CommitDetail> {
  const gh = github();
  const { data } = await gh.repos.getCommit({ owner, repo, ref: sha });
  const files: FileChange[] = (data.files ?? []).map((f) => ({
    path: f.filename,
    previousPath: f.previous_filename,
    status: f.status as FileStatus,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
  return {
    sha: data.sha,
    parentSha: data.parents[0]?.sha ?? "",
    message: data.commit.message,
    author: data.author?.login ?? data.commit.author?.name ?? "unknown",
    date: data.commit.author?.date ?? "",
    url: data.html_url,
    files,
  };
}

/** Commits on the PR, newest first — a history of what changed. */
export async function getPullRequestCommits(
  owner: string,
  repo: string,
  number: number,
): Promise<PrCommit[]> {
  const gh = github();
  const commits = await gh.paginate(gh.pulls.listCommits, {
    owner,
    repo,
    pull_number: number,
    per_page: 100,
  });
  return commits
    .map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      author: c.author?.login ?? c.commit.author?.name ?? "unknown",
      date: c.commit.author?.date ?? c.commit.committer?.date ?? "",
      url: c.html_url,
    }))
    .reverse();
}

/** Inline review threads + the top-level conversation for a PR. */
export async function getPullRequestComments(
  owner: string,
  repo: string,
  number: number,
): Promise<PrComments> {
  const gh = github();

  const [reviewComments, issueComments] = await Promise.all([
    gh.paginate(gh.pulls.listReviewComments, {
      owner,
      repo,
      pull_number: number,
      per_page: 100,
    }),
    gh.paginate(gh.issues.listComments, {
      owner,
      repo,
      issue_number: number,
      per_page: 100,
    }),
  ]);

  const threadsById = new Map<number, PrCommentThread>();
  for (const c of reviewComments) {
    const comment: PrComment = {
      id: c.id,
      author: c.user?.login ?? "unknown",
      avatarUrl: c.user?.avatar_url ?? "",
      body: c.body,
      createdAt: c.created_at,
      url: c.html_url,
    };
    const rootId = c.in_reply_to_id ?? c.id;
    const existing = threadsById.get(rootId);
    if (existing) {
      existing.comments.push(comment);
    } else {
      threadsById.set(rootId, {
        id: rootId,
        path: c.path,
        line: c.line ?? c.original_line ?? null,
        comments: [comment],
      });
    }
  }

  const conversation: PrComment[] = issueComments.map((c) => ({
    id: c.id,
    author: c.user?.login ?? "unknown",
    avatarUrl: c.user?.avatar_url ?? "",
    body: c.body ?? "",
    createdAt: c.created_at,
    url: c.html_url,
  }));

  return { threads: [...threadsById.values()], conversation };
}

const REPO_URL_RE = /\/repos\/([^/]+)\/([^/]+)$/;

/**
 * Repo-wide code-search hits for a symbol (GitHub indexes the default branch),
 * deduped by file. Approximate — useful for "is this used elsewhere".
 */
export async function searchSymbolReferences(
  owner: string,
  repo: string,
  symbol: string,
): Promise<CodeReference[]> {
  const gh = github();
  const { data } = await gh.search.code({
    q: `${symbol} repo:${owner}/${repo} in:file`,
    per_page: 50,
  });
  const seen = new Set<string>();
  const out: CodeReference[] = [];
  for (const item of data.items) {
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    out.push({ path: item.path, url: item.html_url });
  }
  return out;
}

/** PRs that request the token's user as a reviewer, across all repos. */
export async function listReviewRequested(): Promise<DashboardPr[]> {
  const gh = github();
  const items = await gh.paginate(gh.search.issuesAndPullRequests, {
    q: "is:pr is:open review-requested:@me",
    per_page: 100,
    advanced_search: "true",
  });

  const out: DashboardPr[] = [];
  for (const item of items) {
    const m = item.repository_url.match(REPO_URL_RE);
    if (!m) continue;
    out.push({
      owner: m[1],
      repo: m[2],
      number: item.number,
      title: item.title,
      author: item.user?.login ?? "unknown",
      url: item.html_url,
      state: item.state === "closed" ? "closed" : "open",
      updatedAt: item.updated_at,
    });
  }
  return out;
}

/**
 * List a repo's pull requests (most-recently-updated first). Capped so huge
 * repos stay responsive — filtering then happens client-side over this set.
 */
export async function listPullRequests(
  owner: string,
  repo: string,
  state: PrStateFilter = "open",
  cap = 150,
): Promise<PullRequestSummary[]> {
  const gh = github();
  const out: PullRequestSummary[] = [];

  const iterator = gh.paginate.iterator(gh.pulls.list, {
    owner,
    repo,
    state,
    sort: "updated",
    direction: "desc",
    per_page: 100,
  });

  for await (const { data } of iterator) {
    for (const pr of data) {
      out.push({
        number: pr.number,
        title: pr.title,
        state: pr.state === "closed" ? "closed" : "open",
        draft: Boolean(pr.draft),
        merged: Boolean(pr.merged_at),
        author: {
          login: pr.user?.login ?? "unknown",
          avatarUrl: pr.user?.avatar_url ?? "",
        },
        base: { ref: pr.base.ref },
        head: { ref: pr.head.ref },
        labels: (pr.labels ?? []).map((l) =>
          typeof l === "string"
            ? { name: l, color: "888888" }
            : { name: l.name ?? "", color: l.color ?? "888888" },
        ),
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        url: pr.html_url,
      });
      if (out.length >= cap) return out;
    }
  }

  return out;
}

export async function getPullRequest(
  owner: string,
  repo: string,
  number: number,
): Promise<PullRequestData> {
  const gh = github();

  const { data: pr } = await gh.pulls.get({
    owner,
    repo,
    pull_number: number,
  });

  const files = await gh.paginate(gh.pulls.listFiles, {
    owner,
    repo,
    pull_number: number,
    per_page: 100,
  });

  // GitHub diffs the PR against the merge-base, not the base branch tip. Use it
  // as the diff base so the viewer matches GitHub and review comments resolve.
  let mergeBaseSha = pr.base.sha;
  try {
    const { data: cmp } = await gh.repos.compareCommitsWithBasehead({
      owner,
      repo,
      basehead: `${pr.base.sha}...${pr.head.sha}`,
      per_page: 1,
    });
    if (cmp.merge_base_commit?.sha) mergeBaseSha = cmp.merge_base_commit.sha;
  } catch {
    // fall back to base.sha if compare is unavailable
  }

  const pullRequest: PullRequest = {
    owner,
    repo,
    number,
    title: pr.title,
    body: pr.body ?? "",
    state: pr.state === "closed" ? "closed" : "open",
    merged: Boolean(pr.merged),
    author: {
      login: pr.user?.login ?? "unknown",
      avatarUrl: pr.user?.avatar_url ?? "",
    },
    base: { ref: pr.base.ref, sha: pr.base.sha },
    head: { ref: pr.head.ref, sha: pr.head.sha },
    mergeBaseSha,
    labels: (pr.labels ?? []).map((l) => ({
      name: l.name ?? "",
      color: l.color ?? "888888",
    })),
    url: pr.html_url,
    createdAt: pr.created_at,
  };

  const fileChanges: FileChange[] = files.map((f) => ({
    path: f.filename,
    previousPath: f.previous_filename,
    status: f.status as FileStatus,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));

  return { pr: pullRequest, files: fileChanges };
}

/** Just the current head commit SHA — cheap enough to poll for updates. */
export async function getPullRequestHeadSha(
  owner: string,
  repo: string,
  number: number,
): Promise<string> {
  const { data } = await github().pulls.get({ owner, repo, pull_number: number });
  return data.head.sha;
}

/** Fetch a file's text content at a ref. Returns null if missing or not a file. */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string | null> {
  const key = repoKey({ owner, repo });
  const cacheable = isImmutableRef(ref);
  if (cacheable) {
    const hit = getCachedFile(key, ref, path);
    if (hit) return hit.content;
  }

  const gh = github();
  try {
    const { data } = await gh.repos.getContent({ owner, repo, path, ref });
    let content: string | null = null;
    if (
      !Array.isArray(data) &&
      data.type === "file" &&
      typeof data.content === "string"
    ) {
      content = Buffer.from(data.content, "base64").toString("utf8");
    }
    if (cacheable) setCachedFile(key, ref, path, content);
    return content;
  } catch (err: unknown) {
    if (isNotFound(err)) {
      if (cacheable) setCachedFile(key, ref, path, null);
      return null;
    }
    throw err;
  }
}

export async function submitReview(input: SubmitReviewInput): Promise<{ id: number; url: string }> {
  const gh = github();
  const { data } = await gh.pulls.createReview({
    owner: input.owner,
    repo: input.repo,
    pull_number: input.number,
    event: input.event,
    body: input.body || undefined,
    comments: input.comments.map((c) => ({
      path: c.path,
      line: c.line,
      side: c.side,
      body: c.body,
      ...(c.startLine !== undefined
        ? { start_line: c.startLine, start_side: c.side }
        : {}),
    })),
  });
  return { id: data.id, url: data.html_url };
}

/** Post a reply to an existing review-comment thread. Sent immediately. */
export async function replyToReviewComment(
  owner: string,
  repo: string,
  number: number,
  commentId: number,
  body: string,
): Promise<PrComment> {
  const gh = github();
  const { data } = await gh.pulls.createReplyForReviewComment({
    owner,
    repo,
    pull_number: number,
    comment_id: commentId,
    body,
  });
  return {
    id: data.id,
    author: data.user?.login ?? "unknown",
    avatarUrl: data.user?.avatar_url ?? "",
    body: data.body,
    createdAt: data.created_at,
    url: data.html_url,
  };
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    (err as { status?: number }).status === 404
  );
}
