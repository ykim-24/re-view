"use client";

/** Repo PR-list view with state, search, author, label and sort filtering. */

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Search,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { cn } from "@/lib/utils";
import { usePullRequests } from "@/hooks/usePullRequests";
import { useRepoActions } from "@/hooks/useSavedRepos";
import { useQueue } from "@/hooks/useQueue";
import { useRecentPrs } from "@/hooks/useRecentPrs";
import { Select } from "@/components/Select";
import { Tooltip } from "@/components/Tooltip";
import { prKey } from "@/lib/pr-key";
import { timeAgo } from "@/lib/time";
import type {
  DashboardPr,
  Label,
  PrStateFilter,
  PullRequestSummary,
} from "@/domain/pull-request/models";

type Sort = "updated" | "newest" | "oldest";
type FilterMode = PrStateFilter | "bookmarked";

const STATE_OPTIONS: { value: FilterMode; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
  { value: "bookmarked", label: "Bookmarked" },
];

function isFilterMode(value: string): value is FilterMode {
  return ["open", "closed", "all", "bookmarked"].includes(value);
}

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

function isSort(value: string): value is Sort {
  return value === "updated" || value === "newest" || value === "oldest";
}

function compareBySort(sort: Sort, a: PullRequestSummary, b: PullRequestSummary): number {
  if (sort === "updated") return b.updatedAt.localeCompare(a.updatedAt);
  if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
  return a.createdAt.localeCompare(b.createdAt);
}

export function RepoView({ owner, repo }: { owner: string; repo: string }) {
  const [mode, setMode] = useState<FilterMode>("open");
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("all");
  const [label, setLabel] = useState("all");
  const [sort, setSort] = useState<Sort>("updated");

  const githubState: PrStateFilter = mode === "bookmarked" ? "all" : mode;
  const { data, isLoading, isError, error } = usePullRequests(
    owner,
    repo,
    githubState,
  );
  const prs = useMemo(() => data?.prs ?? [], [data]);

  const queue = useQueue();
  const savedKeys = useMemo(
    () => new Set((queue.data?.saved ?? []).map(prKey)),
    [queue.data],
  );

  const { saveRepo } = useRepoActions();
  useEffect(() => {
    saveRepo(owner, repo);
  }, [owner, repo, saveRepo]);

  const authors = useMemo(
    () => [...new Set(prs.map((p) => p.author.login))].sort(),
    [prs],
  );
  const labels = useMemo(
    () => [...new Set(prs.flatMap((p) => p.labels.map((l) => l.name)))].sort(),
    [prs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = prs.filter((p) => {
      if (mode === "bookmarked" && !savedKeys.has(prKey({ owner, repo, number: p.number })))
        return false;
      if (author !== "all" && p.author.login !== author) return false;
      if (label !== "all" && !p.labels.some((l) => l.name === label)) return false;
      if (q) {
        const hay = `${p.title} #${p.number} ${p.author.login}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    result.sort((a, b) => compareBySort(sort, a, b));
    return result;
  }, [prs, search, author, label, sort, mode, savedKeys, owner, repo]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);
  const handleSortChange = (next: string) => {
    if (isSort(next)) setSort(next);
  };
  const handleModeChange = (next: string) => {
    if (isFilterMode(next)) setMode(next);
  };

  const authorOptions = useMemo(
    () => [
      { value: "all", label: "All authors" },
      ...authors.map((a) => ({ value: a, label: a })),
    ],
    [authors],
  );
  const labelOptions = useMemo(
    () => [
      { value: "all", label: "All labels" },
      ...labels.map((l) => ({ value: l, label: l })),
    ],
    [labels],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Tooltip content="Back">
          <Link
            href={`/repo/${owner}/${repo}`}
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Tooltip>
        <div className="min-w-0">
          <div className="truncate font-medium">
            {owner}/{repo}
          </div>
          <div className="text-xs text-muted-foreground">Pull requests</div>
        </div>
        <Tooltip content="Open on GitHub" className="ml-auto flex">
          <a
            href={`https://github.com/${owner}/${repo}/pulls`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Tooltip>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Select value={mode} options={STATE_OPTIONS} onChange={handleModeChange} />

        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Filter by title, #number, author…"
            className="h-8 pl-7"
          />
        </div>

        <Select value={author} options={authorOptions} onChange={setAuthor} />

        {labels.length > 0 && (
          <Select value={label} options={labelOptions} onChange={setLabel} />
        )}

        <Select value={sort} options={SORT_OPTIONS} onChange={handleSortChange} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <QuickLists owner={owner} repo={repo} mode={mode} />

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader label="Loading pull requests…" />
          </div>
        )}

        {isError && (
          <div className="px-4 py-12 text-center text-sm text-destructive">
            {error?.message ?? "Failed to load."}
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No pull requests match.
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <PrCardGrid
            owner={owner}
            repo={repo}
            prs={filtered}
            savedKeys={savedKeys}
            mode={mode}
          />
        )}
      </div>

      {!isLoading && !isError && (
        <div className="border-t px-4 py-1.5 text-xs text-muted-foreground">
          {filtered.length} of {prs.length} shown
          {prs.length >= 150 && " (capped at 150 most-recent)"}
        </div>
      )}
    </div>
  );
}

function StateIcon({ pr }: { pr: PullRequestSummary }) {
  if (pr.merged) return <GitMerge className="h-4 w-4 text-purple-400" />;
  if (pr.state === "closed")
    return <GitPullRequestClosed className="h-4 w-4 text-red-400" />;
  if (pr.draft)
    return <GitPullRequestDraft className="h-4 w-4 text-muted-foreground" />;
  return <GitPullRequest className="h-4 w-4 text-emerald-400" />;
}

function LabelChip({ label }: { label: Label }) {
  return (
    <span
      className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px]"
      style={{ borderColor: `#${label.color}`, color: `#${label.color}` }}
    >
      {label.name}
    </span>
  );
}

interface QuickListsProps {
  owner: string;
  repo: string;
  mode: FilterMode;
}

function QuickLists({ owner, repo, mode }: QuickListsProps) {
  const recent = useRecentPrs(owner, repo);
  const queue = useQueue();

  const bookmarked = useMemo(
    () =>
      (queue.data?.saved ?? [])
        .filter((p) => p.owner === owner && p.repo === repo)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [queue.data, owner, repo],
  );
  const bookmarkedKeys = useMemo(
    () => new Set(bookmarked.map(prKey)),
    [bookmarked],
  );
  const recentOnly = useMemo(
    () =>
      (recent.data?.recent ?? []).filter((p) => !bookmarkedKeys.has(prKey(p))),
    [recent.data, bookmarkedKeys],
  );

  if (mode !== "all") return null;
  if (recentOnly.length === 0 && bookmarked.length === 0) return null;

  return (
    <div className="space-y-5 px-4 pb-2 pt-4">
      <QuickSection
        title="Recent"
        prs={recentOnly}
        labelClassName="text-emerald-400"
      />
      <QuickSection
        title="Bookmarked"
        prs={bookmarked}
        labelClassName="text-amber-400"
      />
    </div>
  );
}

interface QuickSectionProps {
  title: string;
  prs: DashboardPr[];
  labelClassName: string;
}

function QuickSection({ title, prs, labelClassName }: QuickSectionProps) {
  if (prs.length === 0) return null;
  return (
    <div>
      <div
        className={cn(
          "mb-2 text-xs font-semibold uppercase tracking-wide",
          labelClassName,
        )}
      >
        {title}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {prs.map((pr) => (
          <MiniPrCard key={prKey(pr)} pr={pr} />
        ))}
      </div>
    </div>
  );
}

function DashStateIcon({ state }: { state: DashboardPr["state"] }) {
  if (state === "closed")
    return <GitPullRequestClosed className="h-4 w-4 text-red-400" />;
  return <GitPullRequest className="h-4 w-4 text-emerald-400" />;
}

function MiniPrCard({ pr }: { pr: DashboardPr }) {
  return (
    <Tooltip content={pr.title} className="block">
      <Link
        href={`/pr/${pr.owner}/${pr.repo}/${pr.number}`}
        className="flex h-36 flex-col rounded-xl border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-muted/50"
      >
        <div className="flex items-center justify-between">
          <DashStateIcon state={pr.state} />
          <span className="text-[10px] text-muted-foreground">
            {timeAgo(pr.updatedAt)}
          </span>
        </div>
        <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
          #{pr.number}
        </div>
        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {pr.title}
        </div>
        <div className="mt-auto truncate pt-1 text-[10px] text-muted-foreground">
          {pr.author}
        </div>
      </Link>
    </Tooltip>
  );
}

interface PrCardGridProps {
  owner: string;
  repo: string;
  prs: PullRequestSummary[];
  savedKeys: Set<string>;
  mode: FilterMode;
}

function PrCardGrid({ owner, repo, prs, savedKeys, mode }: PrCardGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const el = gridRef.current;
      if (!el) return;
      gsap.from(el.querySelectorAll("[data-pr-card]"), {
        opacity: 0,
        scale: 0.94,
        duration: 0.35,
        ease: "power2.out",
        stagger: 0.04,
        overwrite: "auto",
      });
    },
    { dependencies: [] },
  );

  const isSaved = (pr: PullRequestSummary) =>
    savedKeys.has(prKey({ owner, repo, number: pr.number }));
  const bookmarked = prs.filter(isSaved);
  const others = prs.filter((pr) => !isSaved(pr));

  if (mode === "all" || bookmarked.length === 0) {
    return (
      <div ref={gridRef} className="p-4">
        <CardGrid owner={owner} repo={repo} prs={prs} />
      </div>
    );
  }

  return (
    <div ref={gridRef} className="space-y-5 p-4">
      <PrGroup
        title="Bookmarked"
        labelClassName="text-amber-400"
        owner={owner}
        repo={repo}
        prs={bookmarked}
      />
      <PrGroup
        title={modeLabel(mode)}
        labelClassName="text-muted-foreground"
        owner={owner}
        repo={repo}
        prs={others}
      />
    </div>
  );
}

function modeLabel(mode: FilterMode): string {
  const match = STATE_OPTIONS.find((o) => o.value === mode);
  if (match) return match.label;
  return "Other";
}

interface PrGroupProps {
  title: string;
  labelClassName: string;
  owner: string;
  repo: string;
  prs: PullRequestSummary[];
}

function PrGroup({ title, labelClassName, owner, repo, prs }: PrGroupProps) {
  if (prs.length === 0) return null;
  return (
    <div>
      <div
        className={cn(
          "mb-2 text-xs font-semibold uppercase tracking-wide",
          labelClassName,
        )}
      >
        {title}
      </div>
      <CardGrid owner={owner} repo={repo} prs={prs} />
    </div>
  );
}

interface CardGridProps {
  owner: string;
  repo: string;
  prs: PullRequestSummary[];
}

function CardGrid({ owner, repo, prs }: CardGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      {prs.map((pr) => (
        <PrCard key={pr.number} owner={owner} repo={repo} pr={pr} />
      ))}
    </div>
  );
}

interface PrCardProps {
  owner: string;
  repo: string;
  pr: PullRequestSummary;
}

function PrCard({ owner, repo, pr }: PrCardProps) {
  return (
    <Link
      data-pr-card="true"
      href={`/pr/${owner}/${repo}/${pr.number}`}
      className="flex h-36 flex-col rounded-xl border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-muted/50"
    >
      <div className="flex items-center justify-between">
        <StateIcon pr={pr} />
        <span className="text-[10px] text-muted-foreground">
          {timeAgo(pr.updatedAt)}
        </span>
      </div>
      <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
        #{pr.number}
      </div>
      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {pr.title}
      </div>
      <div className="mt-auto flex items-center gap-1.5 pt-1">
        <span className="truncate text-[10px] text-muted-foreground">
          {pr.author.login}
        </span>
        {pr.labels[0] && <LabelChip label={pr.labels[0]} />}
      </div>
    </Link>
  );
}
