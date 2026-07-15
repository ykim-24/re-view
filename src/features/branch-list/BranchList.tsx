"use client";

/**
 * Branch picker for a repo: a filterable grid of branch cards sharing the PR
 * grid's staggered entrance. Picking a branch opens a comparison of it against
 * the repo's default branch (changeable from there).
 */

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Search,
  Star,
  Copy,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/utils";
import { useBranches } from "@/hooks/useBranches";
import { openCardMenu } from "@/features/card-menu/store";
import type { CardAction } from "@/features/card-menu/types";
import type { BranchSummary } from "@/domain/branch/models";

interface BranchListProps {
  owner: string;
  repo: string;
}

export function BranchList({ owner, repo }: BranchListProps) {
  const { data, isLoading, isError, error } = useBranches(owner, repo);
  const [search, setSearch] = useState("");

  const branches = useMemo(() => data?.branches ?? [], [data]);
  const defaultBranch = data?.defaultBranch ?? "";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => b.name.toLowerCase().includes(q));
  }, [branches, search]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) =>
    setSearch(e.target.value);

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
          <div className="text-xs text-muted-foreground">
            Branches — pick one to compare
          </div>
        </div>
        <Tooltip content="Open on GitHub" className="ml-auto flex">
          <a
            href={`https://github.com/${owner}/${repo}/branches`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Tooltip>
      </header>

      <div className="flex items-center gap-2 border-b px-4 py-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={handleSearchChange}
            placeholder="Filter branches…"
            className="h-8 pl-8 font-mono"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader label="Loading branches…" />
          </div>
        )}

        {isError && (
          <div className="px-4 py-12 text-center text-sm text-destructive">
            {error?.message ?? "Failed to load branches."}
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No branches match.
          </div>
        )}

        {!isLoading && !isError && filtered.length > 0 && (
          <BranchCardGrid
            owner={owner}
            repo={repo}
            branches={filtered}
            defaultBranch={defaultBranch}
          />
        )}
      </div>

      {!isLoading && !isError && (
        <div className="border-t px-4 py-1.5 text-xs text-muted-foreground">
          {filtered.length} of {branches.length} branches
        </div>
      )}
    </div>
  );
}

interface BranchCardGridProps {
  owner: string;
  repo: string;
  branches: BranchSummary[];
  defaultBranch: string;
}

function BranchCardGrid({
  owner,
  repo,
  branches,
  defaultBranch,
}: BranchCardGridProps) {
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
    { dependencies: [branches.length] },
  );

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-4"
    >
      {branches.map((branch) => (
        <BranchCard
          key={branch.name}
          owner={owner}
          repo={repo}
          branch={branch}
          defaultBranch={defaultBranch}
        />
      ))}
    </div>
  );
}

interface BranchCardProps {
  owner: string;
  repo: string;
  branch: BranchSummary;
  defaultBranch: string;
}

function BranchCardBody({ branch }: { branch: BranchSummary }) {
  return (
    <div className="flex h-36 flex-col rounded-xl border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-muted/50">
      <div className="flex items-center justify-between">
        <GitBranch className="h-4 w-4 text-sky-400" />
        {branch.isDefault && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400">
            <Star className="h-3 w-3 fill-amber-400" />
            default
          </span>
        )}
      </div>
      <div className="mt-2 line-clamp-2 break-all font-mono text-sm font-medium">
        {branch.name}
      </div>
      <div className="mt-auto truncate pt-1 font-mono text-[10px] text-muted-foreground">
        {branch.sha.slice(0, 10)}
      </div>
    </div>
  );
}

function BranchCard({ owner, repo, branch, defaultBranch }: BranchCardProps) {
  const base = branch.isDefault ? "" : defaultBranch;
  const href = `/repo/${owner}/${repo}/compare?base=${encodeURIComponent(
    base,
  )}&head=${encodeURIComponent(branch.name)}`;

  const handleContextMenu = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const actions: CardAction[] = [
      {
        id: "github",
        icon: ExternalLink,
        label: "Open on GitHub",
        accent: "hover:text-sky-400",
        onSelect: () =>
          window.open(
            `https://github.com/${owner}/${repo}/tree/${branch.name}`,
            "_blank",
            "noopener",
          ),
      },
      {
        id: "copy",
        icon: Copy,
        label: "Copy branch name",
        onSelect: () => {
          navigator.clipboard.writeText(branch.name);
          toast.success("Branch name copied");
        },
      },
    ];
    openCardMenu({
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      preview: <BranchCardBody branch={branch} />,
      actions,
    });
  };

  return (
    <Tooltip content={branch.name} className="block">
      <Link
        data-pr-card="true"
        href={href}
        onContextMenu={handleContextMenu}
        className="block"
      >
        <BranchCardBody branch={branch} />
      </Link>
    </Tooltip>
  );
}
