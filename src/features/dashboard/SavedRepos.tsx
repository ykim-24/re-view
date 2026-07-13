"use client";

/** Saved repos as a card grid (the home page's primary content). */

import { useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Folder, X } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { useSavedRepos, useRepoActions } from "@/hooks/useSavedRepos";
import { repoKey } from "@/lib/pr-key";
import type { SavedRepo } from "@/domain/pull-request/models";

export function SavedRepos() {
  const { data } = useSavedRepos();
  const repos = data?.repos ?? [];
  const gridRef = useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const el = gridRef.current;
      if (!el || repos.length === 0) return;
      gsap.from(el.children, {
        opacity: 0,
        scale: 0.94,
        duration: 0.35,
        ease: "power2.out",
        stagger: 0.04,
      });
    },
    { dependencies: [repos.length] },
  );

  if (repos.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        No saved repos yet — add one above to get started.
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h2 className="mb-3 text-sm font-semibold">Saved repos</h2>
      <div
        ref={gridRef}
        className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3"
      >
        {repos.map((repo) => (
          <RepoCard key={repoKey(repo)} repo={repo} />
        ))}
      </div>
    </div>
  );
}

function RepoCard({ repo }: { repo: SavedRepo }) {
  const { removeRepo } = useRepoActions();
  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeRepo(repoKey(repo));
  };

  return (
    <Link
      href={`/repo/${repo.owner}/${repo.repo}`}
      className="group relative flex h-28 flex-col justify-between rounded-xl border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-muted/50"
    >
      <button
        onClick={handleRemove}
        className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
        aria-label="Remove saved repo"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <Folder className="h-4 w-4 text-muted-foreground" />
      <div>
        <div className="truncate text-sm font-semibold">{repo.repo}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {repo.owner} · {timeAgo(repo.lastOpenedAt)}
        </div>
      </div>
    </Link>
  );
}
